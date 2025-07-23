import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Received data callback request from Coinbase');

    // Parse the request body according to official documentation
    const requestData = await request.json();

    console.log('📋 Data callback payload:', {
      calls: requestData.calls?.length || 0,
      chainId: requestData.chainId,
      version: requestData.version,
      hasRequestedInfo: !!requestData.capabilities?.dataCallback?.requestedInfo,
    });

    // Extract the requested user data
    const { requestedInfo } = requestData.capabilities?.dataCallback || {};

    if (!requestedInfo) {
      console.error('❌ No requested info found in callback');
      return NextResponse.json({ errors: { server: 'No requested info found in callback' } }, { status: 400 });
    }

    // Log the received data for development purposes (with privacy protection)
    console.log('✅ Successfully received user data:', {
      email: requestedInfo.email ? '***@***.com' : undefined,
      phoneNumber: requestedInfo.phoneNumber
        ? {
            number: '***-***-****',
            country: requestedInfo.phoneNumber.country,
            isPrimary: requestedInfo.phoneNumber.isPrimary,
          }
        : undefined,
      physicalAddress: requestedInfo.physicalAddress ? '[REDACTED ADDRESS]' : undefined,
      name: requestedInfo.name ? '[REDACTED NAME]' : undefined,
      onchainAddress: requestedInfo.onchainAddress,
    });

    // Example validation (you can customize this logic)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors: Record<string, any> = {};

    // Validate email
    if (requestedInfo.email && requestedInfo.email.endsWith('@example.com')) {
      errors.email = 'Example.com emails are not allowed';
    }

    // Validate physical address
    if (requestedInfo.physicalAddress) {
      const addr = requestedInfo.physicalAddress;
      if (addr.postalCode && addr.postalCode.length < 5) {
        if (!errors.physicalAddress) errors.physicalAddress = {};
        errors.physicalAddress.postalCode = 'Invalid postal code';
      }
    }

    // Return validation errors if any found
    if (Object.keys(errors).length > 0) {
      console.log('⚠️ Validation errors found:', errors);
      return NextResponse.json({ errors });
    }

    // Success - return the original calls as per documentation
    console.log('✅ Data validation successful, returning original calls');
    return NextResponse.json({
      calls: requestData.calls,
      chainId: requestData.chainId,
      version: requestData.version,
      capabilities: requestData.capabilities,
    });
  } catch (error) {
    console.error('💥 Error processing data callback:', error);

    return NextResponse.json(
      { errors: { server: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 },
    );
  }
}

// Handle GET requests (for testing/health checks)
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Data callback endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
