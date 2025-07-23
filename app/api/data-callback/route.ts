// Add CORS headers for external requests from Base Pay
function addCorsHeaders(response: Response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

// Handle preflight OPTIONS requests
export async function OPTIONS() {
  const response = new Response(null, { status: 200 });
  return addCorsHeaders(response);
}

export async function POST(request: Request) {
  console.log('📨 Received data callback request from Coinbase');
  console.log('📍 Request URL:', request.url);
  console.log('📋 Request headers:', Object.fromEntries(request.headers.entries()));

  try {
    const requestData = await request.json();
    console.log('📋 Full request data:', JSON.stringify(requestData, null, 2));

    // Validate required fields
    if (!requestData.calls || !requestData.chainId || !requestData.version) {
      console.error('❌ Missing required fields:', {
        hasCalls: !!requestData.calls,
        hasChainId: !!requestData.chainId,
        hasVersion: !!requestData.version,
      });
      const response = Response.json({
        errors: { server: 'Missing required fields' },
      });
      return addCorsHeaders(response);
    }

    if (!requestData.capabilities?.dataCallback) {
      console.error('❌ Missing dataCallback capability');
      const response = Response.json({
        errors: { server: 'Missing dataCallback capability' },
      });
      return addCorsHeaders(response);
    }

    const { requestedInfo } = requestData.capabilities.dataCallback;

    if (!requestedInfo) {
      console.log('⚠️ No requestedInfo - returning original request');
      const response = Response.json({
        calls: requestData.calls,
        chainId: requestData.chainId,
        version: requestData.version,
        capabilities: requestData.capabilities,
      });
      return addCorsHeaders(response);
    }

    console.log('📋 RequestedInfo received:', {
      hasEmail: !!requestedInfo.email,
      hasPhoneNumber: !!requestedInfo.phoneNumber,
      hasPhysicalAddress: !!requestedInfo.physicalAddress,
      hasName: !!requestedInfo.name,
      hasOnchainAddress: !!requestedInfo.onchainAddress,
    });

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

    // Return errors if any found
    if (Object.keys(errors).length > 0) {
      console.log('⚠️ Validation errors found:', errors);
      const errorResponse = { errors };
      console.log('📤 Sending error response:', JSON.stringify(errorResponse, null, 2));
      const response = Response.json(errorResponse);
      return addCorsHeaders(response);
    }

    // Success - return original calls with exact same structure
    const successResponse = {
      calls: requestData.calls,
      chainId: requestData.chainId,
      version: requestData.version,
      capabilities: requestData.capabilities,
    };

    console.log('✅ Validation successful');
    console.log('📤 Sending success response:', JSON.stringify(successResponse, null, 2));

    const response = Response.json(successResponse);
    return addCorsHeaders(response);
  } catch (error) {
    console.error('❌ Data callback error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');

    const errorResponse = {
      errors: { server: 'Server error validating data' },
    };
    console.log('📤 Sending server error response:', JSON.stringify(errorResponse, null, 2));

    const response = Response.json(errorResponse);
    return addCorsHeaders(response);
  }
}

// Handle GET requests (for testing/health checks)
export async function GET(): Promise<Response> {
  console.log('📨 GET request to data callback endpoint');
  const response = Response.json({
    message: 'Data callback endpoint is active',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
  return addCorsHeaders(response);
}
