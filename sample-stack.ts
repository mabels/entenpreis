import cdk = require("@aws-cdk/core");
import { createDomains, CreateDomainsProps } from "./src/create-domains";
import { EKSProps, eksStack } from "./src/eks-stack";
import { externalDNS } from "./src/external-dns";
// import { delegation53 } from './src/delegation53';
import { githubWorker, GithubWorkerProps } from "./src/github-worker";
import { developerServiceAccount } from "./src/developer-service-account";
import { autoscaler, AutoScalerProps } from "./src/autoscaler";

export interface StackProps extends cdk.StackProps {
  readonly createDomains: CreateDomainsProps;
  readonly eksProps: EKSProps;
  readonly infrastructGithubWorker: GithubWorkerProps;
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
    // delegation53(eks, { zones, rolesARN: [] })
    githubWorker(eks, zones, devAdmin, props.infrastructGithubWorker);
  }
}
