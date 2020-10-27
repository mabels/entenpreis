import * as aws from "@pulumi/aws";

export interface CreateDomainsProps {
  readonly newDomains?: string[];
  readonly refDomains?: string[];
}

export function createDomains(props: CreateDomainsProps): aws.route53.Zone[] {
  const refZones =
    props.refDomains?.map((d) =>
      aws.route53.Zone.get(`ref-${d.split('.').join('-')}`, d, {
       name: d
      })
    ) || [];
  const newDomains =
    props.newDomains?.map(
      (d) =>
        new aws.route53.Zone(d.split('.').join('-'), {
          name
        })
    ) || [];
  return refZones.concat(newDomains);
}
