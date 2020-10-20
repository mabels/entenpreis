import route53 = require('@aws-cdk/aws-route53');
import cdk = require('@aws-cdk/core');

export interface CreateDomainsProps {
  readonly newDomains?: string[];
  readonly refDomains?: string[];
}

export function createDomains(
  stack: cdk.Stack,
  props: CreateDomainsProps,
): route53.IPublicHostedZone[] {
  const refZones =
    props.refDomains?.map((d) =>
      route53.PublicHostedZone.fromLookup(stack, `ref-${d.split('.').join('-')}`, {
        domainName: d,
      }),
    ) || [];
  const newDomains =
    props.newDomains?.map(
      (d) =>
        new route53.PublicHostedZone(stack, d.split('.').join('-'), {
          zoneName: d,
        }),
    ) || [];
  return refZones.concat(newDomains);
}
