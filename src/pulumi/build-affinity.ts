import * as k8s from "@pulumi/kubernetes";

export interface BuildAffinityProps {
    readonly nodeGroup?: string
}
export function buildAffinity(props: BuildAffinityProps): {
    affinity?: k8s.types.input.core.v1.Affinity} {
    return (props.nodeGroup ? {
          affinity: {
            nodeAffinity: {
              requiredDuringSchedulingIgnoredDuringExecution: {
                nodeSelectorTerms: [{
                  matchExpressions: [{
                    key: 'nodegroup',
                    operator: 'In',
                    values: [props.nodeGroup]
                  }]
                }]
              }
            }
          }
        } : {})
}