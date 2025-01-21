import { Construct } from 'constructs';
import ecs = require('aws-cdk-lib/aws-ecs');
import ecr = require('aws-cdk-lib/aws-ecr');
import ec2 = require('aws-cdk-lib/aws-ec2');
import elbv2 = require('aws-cdk-lib/aws-elasticloadbalancingv2');
import cdk = require('aws-cdk-lib');

const EPHEMERAL_PORT_RANGE = ec2.Port.tcpRange(32768, 65535);

export class TestAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
      // Create a cluster
      const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });

      const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO)
      });

      // Create Task Definition
      const repository = ecr.Repository.fromRepositoryArn(
        this,
        'matific/testapp',
        'arn:aws:ecr:sa-east-1:807181840404:repository/matific/test-app',
      );
      const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromEcrRepository(repository, '2'),
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
          containerName: 'web',
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
