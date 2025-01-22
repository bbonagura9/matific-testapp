import { Construct } from 'constructs';
import ecs = require('aws-cdk-lib/aws-ecs');
import ecr = require('aws-cdk-lib/aws-ecr');
import ec2 = require('aws-cdk-lib/aws-ec2');
import elbv2 = require('aws-cdk-lib/aws-elasticloadbalancingv2');
import cdk = require('aws-cdk-lib');

const EPHEMERAL_PORT_RANGE = ec2.Port.tcpRange(32768, 65535);
const DEFAULT_TAG = '1'
const DEFAULT_REPOSITORY_ARN = 'arn:aws:ecr:sa-east-1:807181840404:repository/matific/test-app'

export class TestAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
      const vpc = new ec2.Vpc(this, 'Vpc', { 
        maxAzs: 2,
        natGateways: 0,
        ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/24'),
        subnetConfiguration: [
          {
            cidrMask: 26,
            name: 'A',
            subnetType: ec2.SubnetType.PUBLIC,
          },
          {
            cidrMask: 26,
            name: 'B',
            subnetType: ec2.SubnetType.PUBLIC,
          },
        ]
      });

      // Create a cluster
      const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO)
      });

      // Create Task Definition
      const imageTag = this.node.tryGetContext('tag') || DEFAULT_TAG;
      const imageRepository = this.node.tryGetContext('repositoryArn') || DEFAULT_REPOSITORY_ARN;

      const repository = ecr.Repository.fromRepositoryArn(this, 'TestAppRepository', imageRepository);
      const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
      const container = taskDefinition.addContainer('Web', {
        image: ecs.ContainerImage.fromEcrRepository(repository, imageTag),
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
