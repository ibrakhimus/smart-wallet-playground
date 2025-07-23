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

  try {
    const requestData = await request.json();
    console.log('📋 Request data:', JSON.stringify(requestData, null, 2));

    const { requestedInfo } = requestData.capabilities.dataCallback;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors: Record<string, any> = {};

    // Validate email
    if (requestedInfo.email && requestedInfo.email.endsWith('@example.com')) {
      errors.email = 'Example.com emails are not allowed';
    }

    // Validate physical address - using the structure from docs
    if (requestedInfo.physicalAddress) {
      const addr = requestedInfo.physicalAddress;
      if (addr.postalCode && addr.postalCode.length < 5) {
        if (!errors.physicalAddress) errors.physicalAddress = {};
        errors.physicalAddress.postalCode = 'Invalid postal code';
      }
    }

    // Return errors if any found
    if (Object.keys(errors).length > 0) {
      console.log('⚠️ Validation errors:', errors);
      const response = Response.json({ errors });
      return addCorsHeaders(response);
    }

    // Success - return original calls
    console.log('✅ Validation successful, returning original calls');
    const response = Response.json({
      calls: requestData.calls,
      chainId: requestData.chainId,
      version: requestData.version,
      capabilities: requestData.capabilities,
    });
    return addCorsHeaders(response);
  } catch (error) {
    console.error('❌ Data callback error:', error);
    const response = Response.json({
      errors: { server: 'Server error validating data' },
    });
    return addCorsHeaders(response);
  }
}

// Handle GET requests (for testing/health checks)
export async function GET(): Promise<Response> {
  const response = Response.json({
    message: 'Data callback endpoint is active',
    timestamp: new Date().toISOString(),
  });
  return addCorsHeaders(response);
}
