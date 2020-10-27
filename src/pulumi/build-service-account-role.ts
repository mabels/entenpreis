import * as aws from "@pulumi/aws";
import { Input, ProviderResource } from '@pulumi/pulumi';

export interface BuildServiceAccountRoleProps {
    readonly existingRole?: string
    readonly newRole?: {
        readonly name: string;
        readonly oidcId: string;
        readonly accountId: string;
        readonly namespace: string;
    }
    readonly policyDocument: aws.iam.PolicyDocument;
    readonly provider?: ProviderResource;
}

export async function buildServiceAccountRole(props: BuildServiceAccountRoleProps) {
    if ((props.existingRole && props.newRole) || (!props.existingRole && !props.newRole)) {
        throw Error("it is only allow to set one of existingRole,newRole")
    }
    let role: aws.iam.Role;
    if (props.existingRole) {
        role = aws.iam.Role.get(props.existingRole, props.existingRole, undefined, {
            provider: props.provider,
        });
    }
    if (props.newRole) {
        const region = await aws.getRegion()
        role = new aws.iam.Role(props.newRole.name, {
            assumeRolePolicy: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: "sts:AssumeRoleWithWebIdentity",
                        Principal: {
                            Federated:
                                `arn:aws:iam::${props.newRole.accountId}:oidc-provider/oidc.eks.${region}.amazonaws.com/id/${props.newRole.oidcId}`,
                        },
                        Effect: "Allow",
                        Sid: "",
                        Condition: {
                            StringEquals: {
                                [`oidc.eks.${region}.amazonaws.com/id/${props.newRole.oidcId}:sub`]:
                                    `system:serviceaccount:${props.newRole.namespace}:${props.newRole.name}`,
                                [`oidc.eks.${region}.amazonaws.com/id/${props.newRole.oidcId}:aud`]:
                                    "sts.amazonaws.com",
                            },
                        },
                    },
                ],
            },
        });
    }
    new aws.iam.RolePolicy("cert-manager-policy", {
        role: role!,
        policy: props.policyDocument
    });
    return role!;
}