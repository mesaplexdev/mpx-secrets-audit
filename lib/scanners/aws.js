/**
 * AWS IAM Access Key Scanner
 * Requires @aws-sdk/client-iam (optional dependency)
 */

let IAMClient, ListAccessKeysCommand, GetAccessKeyLastUsedCommand;

try {
  const awsSdk = await import('@aws-sdk/client-iam');
  IAMClient = awsSdk.IAMClient;
  ListAccessKeysCommand = awsSdk.ListAccessKeysCommand;
  GetAccessKeyLastUsedCommand = awsSdk.GetAccessKeyLastUsedCommand;
} catch (error) {
  // AWS SDK not installed - graceful degradation
}

/**
 * Check if AWS scanning is available
 */
export function isAvailable() {
  return !!IAMClient;
}

/**
 * Scan AWS IAM for access keys
 */
export async function scanAwsKeys() {
  if (!isAvailable()) {
    throw new Error(
      'AWS SDK not installed. Install with: npm install @aws-sdk/client-iam'
    );
  }

  try {
    const client = new IAMClient({});
    const command = new ListAccessKeysCommand({});
    const response = await client.send(command);

    const keys = [];

    for (const accessKey of response.AccessKeyMetadata || []) {
      try {
        // Get last used info
        const lastUsedCommand = new GetAccessKeyLastUsedCommand({
          AccessKeyId: accessKey.AccessKeyId
        });
        const lastUsedResponse = await client.send(lastUsedCommand);

        const keyInfo = {
          name: `aws-key-${accessKey.AccessKeyId.slice(-4)}`,
          provider: 'aws',
          type: 'access_key',
          keyId: accessKey.AccessKeyId.slice(-4), // Last 4 chars only
          status: accessKey.Status,
          createdAt: accessKey.CreateDate.toISOString().split('T')[0],
          lastUsed: lastUsedResponse.AccessKeyLastUsed?.LastUsedDate
            ? lastUsedResponse.AccessKeyLastUsed.LastUsedDate.toISOString().split('T')[0]
            : 'Never',
          age: Math.ceil((new Date() - accessKey.CreateDate) / (1000 * 60 * 60 * 24))
        };

        keys.push(keyInfo);
      } catch (error) {
        // Collect partial failures - don't crash the whole scan
        keys.push({
          name: `aws-key-${accessKey.AccessKeyId.slice(-4)}`,
          provider: 'aws',
          type: 'access_key',
          keyId: accessKey.AccessKeyId.slice(-4),
          status: accessKey.Status || 'Unknown',
          createdAt: accessKey.CreateDate ? accessKey.CreateDate.toISOString().split('T')[0] : 'Unknown',
          lastUsed: 'Unknown',
          age: accessKey.CreateDate ? Math.ceil((new Date() - accessKey.CreateDate) / (1000 * 60 * 60 * 24)) : null,
          scanError: error.message
        });
      }
    }

    return keys;
  } catch (error) {
    if (error.name === 'CredentialsProviderError' || error.name === 'ProviderError') {
      throw new Error(
        'AWS credentials not configured. Set up ~/.aws/credentials or environment variables.'
      );
    }
    throw new Error(`AWS scan failed: ${error.message}`);
  }
}

/**
 * Convert scanned keys to secret format for tracking
 */
export function convertToSecrets(keys) {
  return keys.map(key => ({
    name: key.name,
    provider: 'aws',
    type: 'access_key',
    createdAt: key.createdAt,
    expiresAt: null,
    lastRotated: key.createdAt,
    rotationPolicy: 90,
    notes: `AWS IAM Access Key ****${key.keyId} | Status: ${key.status} | Last used: ${key.lastUsed}`
  }));
}
