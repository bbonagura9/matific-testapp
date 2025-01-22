import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cdk from 'aws-cdk-lib';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'path';

const EPHEMERAL_PORT_RANGE = ec2.Port.tcpRange(32768, 65535);

export class TestAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
      // Build the docker image
      const asset = new DockerImageAsset(this, 'TestAppImage', {
        directory: path.normalize(path.join(__dirname, '..', '..')),
        exclude: [
          '.git',
          'cdk',
        ]
      });

      // Create VPC
      const vpc = new ec2.Vpc(this, 'Vpc', { 
        maxAzs: 2,
        natGateways: 1,
        ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/24'),
        subnetConfiguration: [
          {
            cidrMask: 26,
            name: 'public',
            subnetType: ec2.SubnetType.PUBLIC,
          },
          {
            cidrMask: 26,
            name: 'private',
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          }
        ]
      });

      // Create a cluster
      const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', {
        minCapacity: 2,  // for HA
        instanceType: new ec2.InstanceType('t2.micro'),
      });

      // Create Task Definition
      const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
      const container = taskDefinition.addContainer('Web', {
        image: ecs.ContainerImage.fromDockerImageAsset(asset),
        memoryLimitMiB: 128,
      });

      container.addPortMappings({
        containerPort: 8000,
        protocol: ecs.Protocol.TCP
      });

      // Create Service
      const service = new ecs.Ec2Service(this, 'Service', {
        cluster,
        taskDefinition,
        desiredCount: 2,
        minHealthyPercent: 100,
      });
      service.connections.allowFromAnyIpv4(EPHEMERAL_PORT_RANGE);

      // Create ALB
      const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
        vpc,
        internetFacing: true
      });
      const listener = lb.addListener('PublicListener', { port: 80, open: true });

      // Attach ALB to ECS Service
      listener.addTargets('ECS', {
        port: 80,
        targets: [service.loadBalancerTarget({
          containerName: 'Web',
          containerPort: 8000
        })],
        // include health check (default is none)
        healthCheck: {
          interval: cdk.Duration.seconds(60),
          path: '/health/',
          timeout: cdk.Duration.seconds(5),
        }
      });

      new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: lb.loadBalancerDnsName, });
  }
}
