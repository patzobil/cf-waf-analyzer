import { Env } from '../../lib/types';
import { handleUpload } from './upload';
import { handleEvents } from './events';
import { handleSummary } from './summary';
import { handleTrends } from './trends';
import { handleTopRules, handleTopIPs, handleTopPaths } from './top';
import { handleReindex } from './reindex';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = params.route ? (Array.isArray(params.route) ? params.route.join('/') : params.route) : '';
  
  // CORS headers for API routes
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Simple token authentication check for protected routes
  const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
  const isProtectedRoute = path === 'reindex' || request.method === 'POST';
  
  if (isProtectedRoute && authToken !== env.AUTH_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let response: Response;

    // Route handling
    switch (true) {
      case path === 'upload' && request.method === 'POST':
        response = await handleUpload(request, env);
        break;
      
      case path === 'events' && request.method === 'GET':
        response = await handleEvents(request, env);
        break;
      
      case path === 'summary' && request.method === 'GET':
        response = await handleSummary(request, env);
        break;
      
      case path === 'trends' && request.method === 'GET':
        response = await handleTrends(request, env);
        break;
      
      case path === 'rules/top' && request.method === 'GET':
        response = await handleTopRules(request, env);
        break;
      
      case path === 'ips/top' && request.method === 'GET':
        response = await handleTopIPs(request, env);
        break;
      
      case path === 'paths/top' && request.method === 'GET':
        response = await handleTopPaths(request, env);
        break;
      
      case path === 'reindex' && request.method === 'POST':
        response = await handleReindex(request, env);
        break;
      
      default:
        response = new Response(JSON.stringify({ error: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    // Add CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};
