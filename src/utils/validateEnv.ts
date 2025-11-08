/**
 * Validate required environment variables on backend startup
 */

interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate PromptPay phone number format
 */
const validatePromptPayPhone = (phone: string | undefined): { valid: boolean; error?: string } => {
  if (!phone) {
    return { valid: false, error: 'PROMPTPAY_PHONE_NUMBER is not set' };
  }

  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length !== 10) {
    return { 
      valid: false, 
      error: `PROMPTPAY_PHONE_NUMBER must be 10 digits (got ${cleanPhone.length} digits)` 
    };
  }

  if (!cleanPhone.startsWith('0')) {
    return { 
      valid: false, 
      error: 'PROMPTPAY_PHONE_NUMBER must start with 0' 
    };
  }

  return { valid: true };
};

/**
 * Validate all required environment variables
 */
export const validateEnvironmentVariables = (): EnvValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate MONGODB_URI
  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is not set');
  }

  // Validate JWT_SECRET
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is not set');
  } else if (process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters for security');
  }

  // Validate PROMPTPAY_PHONE_NUMBER
  const phoneValidation = validatePromptPayPhone(process.env.PROMPTPAY_PHONE_NUMBER);
  if (!phoneValidation.valid) {
    errors.push(phoneValidation.error!);
  }

  // Validate PORT (optional but recommended)
  if (!process.env.PORT) {
    warnings.push('PORT is not set, will use default');
  }

  // Validate NODE_ENV
  if (!process.env.NODE_ENV) {
    warnings.push('NODE_ENV is not set, defaulting to development');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Log validation results and exit if critical errors found
 */
export const validateAndLogEnvironment = (): void => {
  console.log('🔍 Validating environment variables...');
  
  const result = validateEnvironmentVariables();

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    result.warnings.forEach(warning => {
      console.warn(`   - ${warning}`);
    });
  }

  // Log errors and exit if invalid
  if (!result.isValid) {
    console.error('❌ Environment validation failed:');
    result.errors.forEach(error => {
      console.error(`   - ${error}`);
    });
    console.error('\n💡 Please check your .env file and ensure all required variables are set correctly.');
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
};
