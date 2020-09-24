import route53 = require("@aws-cdk/aws-route53");
import cdk = require("@aws-cdk/core")

export interface CreateDomainsProps {
    readonly domains: string[];
  }
  export function createDomains(
    stack: cdk.Stack,
    props: CreateDomainsProps
  ) {
    const zones = props.domains.map(
      (d) =>
        new route53.PublicHostedZone(stack, d.split(".").join('-'), {
          zoneName: d,
        })
    );
    return zones;
  }
