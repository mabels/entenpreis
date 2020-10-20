import cdk = require("@aws-cdk/core");
import { createDomains, CreateDomainsProps } from "../cdk/create-domains";
import { EKSProps, eksStack } from "../cdk/eks-stack";
import { externalDNS } from "../cdk/external-dns";
import { delegation53 } from '../cdk/delegation53';
import { githubWorker, GithubWorkerProps } from "../cdk/github-worker";
import { developerServiceAccount } from "../cdk/developer-service-account";
import { autoscaler, AutoScalerProps } from "../cdk/autoscaler";
import { EbsDeviceVolumeType } from '@aws-cdk/aws-ec2';

export interface StackProps extends cdk.StackProps {
  readonly createDomains: CreateDomainsProps;
  readonly eksProps: EKSProps;
  readonly infrastructureGithubWorker: GithubWorkerProps;
  readonly autoscaler: AutoScalerProps;
}

export class SampleAccount extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: StackProps) {
    super(scope, id, props);

    const eks = eksStack(this, props.eksProps);
    autoscaler(this, eks, props.autoscaler);
    const devAdmin = developerServiceAccount(eks, {});
    const zones = createDomains(this, props.createDomains);
    externalDNS(eks, { zones });
    delegation53(eks, { zones, rolesARN: [] })
    githubWorker(eks, zones, devAdmin, props.infrastructureGithubWorker);
  }
}

const app = new cdk.App()
new SampleAccount(app, 'Sample', {
  createDomains: { },
  eksProps: {
    baseName: 'Sample',
    cidr: "172.20.13.0/23"
  },
  infrastructureGithubWorker: {
    url: 'https://gug/huh/ho',
    token: 'xxx',
    image: 'xxx'
  },
  autoscaler: {
    instanceType: "t3a.medium",
    minCapacity: 1,
    blockDevices: [
      {
        deviceName: '/dev/xxx',
        size: 200
      }
    ]
  }
});

app.synth();
