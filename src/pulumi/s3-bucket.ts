import * as aws from "@pulumi/aws";

export interface S3BucketProps {
  readonly name: string;
  readonly bucketName?: string;
  readonly role?: aws.iam.Role;
  readonly acl?: aws.s3.CannedAcl;
  readonly applyServerSideEncryptionByDefault?: aws.types.input.s3.BucketServerSideEncryptionConfigurationRuleApplyServerSideEncryptionByDefault
  readonly blockPublicAcls?: boolean;
  readonly blockPublicPolicy?: boolean;
  readonly ignorePublicAcls?: boolean;
  readonly restrictPublicBuckets?: boolean;
}

export function createS3Bucket(props: S3BucketProps) {
  const bucket = new aws.s3.Bucket(props.name, {
    bucket: props.bucketName,
    acl: props.acl || aws.s3.CannedAcl.Private,
    serverSideEncryptionConfiguration: {
      rule: {
        applyServerSideEncryptionByDefault: props.applyServerSideEncryptionByDefault || {
          sseAlgorithm: "AES256",
        },
      },
    }
  });

  new aws.s3.BucketPublicAccessBlock("bucketPublicAccessBlock", {
    bucket: bucket.id,
    blockPublicAcls: props.blockPublicAcls || true,
    blockPublicPolicy: props.blockPublicPolicy || true,
    ignorePublicAcls: props.ignorePublicAcls || true,
    restrictPublicBuckets: props.restrictPublicBuckets || true
  });

  return bucket;
}
