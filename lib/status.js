/**
 * Calculate the status of a secret based on rotation policy and expiry
 */
export function calculateStatus(secret) {
  const now = new Date();
  
  // Check if expired
  if (secret.expiresAt) {
    const expiryDate = new Date(secret.expiresAt);
    if (expiryDate < now) {
      return 'expired';
    }
    
    // Check days until expiry
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 7) {
      return 'critical';
    }
    if (daysUntilExpiry < 30) {
      return 'warning';
    }
  }
  
  // Check rotation policy
  if (secret.rotationPolicy && secret.lastRotated) {
    const lastRotatedDate = new Date(secret.lastRotated);
    const daysSinceRotation = Math.ceil((now - lastRotatedDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceRotation > secret.rotationPolicy) {
      return 'critical';
    }
    
    // 75% through rotation policy
    const warningThreshold = secret.rotationPolicy * 0.75;
    if (daysSinceRotation > warningThreshold) {
      return 'warning';
    }
  }
  
  return 'healthy';
}

/**
 * Get the emoji for a status
 */
export function getStatusEmoji(status) {
  switch (status) {
    case 'healthy':
      return '🟢';
    case 'warning':
      return '🟡';
    case 'critical':
      return '🔴';
    case 'expired':
      return '⛔';
    default:
      return '⚪';
  }
}

/**
 * Calculate age in days since creation or last rotation
 */
export function calculateAge(secret) {
  const now = new Date();
  const referenceDate = secret.lastRotated 
    ? new Date(secret.lastRotated)
    : secret.createdAt 
      ? new Date(secret.createdAt)
      : null;
  
  if (!referenceDate) {
    return null;
  }
  
  return Math.ceil((now - referenceDate) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days until expiry
 */
export function daysUntilExpiry(secret) {
  if (!secret.expiresAt) {
    return null;
  }
  
  const now = new Date();
  const expiryDate = new Date(secret.expiresAt);
  const days = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  
  return days;
}

/**
 * Get a human-readable message for the status
 */
export function getStatusMessage(secret) {
  const status = calculateStatus(secret);
  const age = calculateAge(secret);
  const daysToExpiry = daysUntilExpiry(secret);
  
  switch (status) {
    case 'expired':
      return `Expired ${Math.abs(daysToExpiry)} days ago`;
    case 'critical':
      if (daysToExpiry !== null && daysToExpiry < 7) {
        return `Expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}`;
      }
      if (secret.rotationPolicy && age > secret.rotationPolicy) {
        return `Past rotation policy by ${age - secret.rotationPolicy} days`;
      }
      return 'Critical';
    case 'warning':
      if (daysToExpiry !== null && daysToExpiry < 30) {
        return `Expires in ${daysToExpiry} days`;
      }
      if (secret.rotationPolicy && age) {
        const remaining = secret.rotationPolicy - age;
        return `${remaining} days until rotation due`;
      }
      return 'Warning';
    case 'healthy':
      return 'Healthy';
    default:
      return 'Unknown';
  }
}
