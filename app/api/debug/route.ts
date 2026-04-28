import { NextResponse } from 'next/server';
import axios from 'axios';

function isAuthorized(request: Request): boolean {
  const secret = String(process.env.DEBUG_API_SECRET || process.env.SYNC_ADMIN_SECRET || '').trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = request.headers.get('x-debug-secret') || '';
  const bearer = request.headers.get('authorization') || '';
  if (header && header === secret) return true;
  if (bearer.toLowerCase().startsWith('bearer ') && bearer.slice(7).trim() === secret) return true;
  return false;
}

// Teste direto da API NBA.com
async function testNBAApi() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const year = today.getFullYear();
  const dateStr = `${month}/${day}/${year}`;
  
  console.log('Testing NBA.com API with date:', dateStr);
  
  try {
    // Teste direto com axios
    const response = await axios.get('https://stats.nba.com/stats/scoreboard', {
      params: { GameDate: dateStr },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Origin': 'https://www.nba.com',
        'Referer': 'https://www.nba.com/',
      },
      timeout: 15000,
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', JSON.stringify(response.headers).slice(0, 500));
    console.log('Response data keys:', Object.keys(response.data));
    console.log('Response data:', JSON.stringify(response.data).slice(0, 2000));
    
    return response.data;
  } catch (error: any) {
    console.error('=== DIRECT API ERROR ===');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.message);
    console.error('Data:', error.response?.data);
    throw error;
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({
      debug: false,
      error: 'Unauthorized debug request',
    }, { status: 401 });
  }

  const todayNBA = new Date();
  const month = String(todayNBA.getMonth() + 1).padStart(2, '0');
  const day = String(todayNBA.getDate()).padStart(2, '0');
  const year = todayNBA.getFullYear();
  const dateStr = `${month}/${day}/${year}`;
  
  console.log('=== DEBUG: Testing NBA.com API ===');
  console.log('Requested date:', dateStr);
  
  // Primeiro, vamos testar a API diretamente
  try {
    const rawData = await testNBAApi();
    
    // Verificar estrutura dos dados
    if (!rawData) {
      return NextResponse.json({
        debug: true,
        error: 'Empty response from NBA.com',
        attemptedDate: dateStr
      }, { status: 404 });
    }
    
    // Verificar se tem resultSets
    if (rawData.resultSets) {
      return NextResponse.json({
        debug: true,
        success: true,
        structure: 'resultSets',
        resultSets: Object.keys(rawData.resultSets),
        date: dateStr
      });
    }
    
    // Verificar se tem results
    if (rawData.results) {
      return NextResponse.json({
        debug: true,
        success: true,
        structure: 'results',
        resultsCount: rawData.results?.length,
        date: dateStr
      });
    }
    
    // Qualquer outra estrutura
    return NextResponse.json({
      debug: true,
      rawResponse: JSON.stringify(rawData).slice(0, 1000),
      date: dateStr,
      message: 'Response received but unknown format'
    });
    
  } catch (error: any) {
    const errorInfo = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    };
    
    console.error('API Error:', errorInfo);
    
    return NextResponse.json({
      debug: true,
      error: 'NBA.com API Failed',
      ...errorInfo,
      attemptedDate: dateStr,
      suggestions: [
        'NBA.com may be blocking requests',
        'Try using sportsdataapi.com instead',
        'Check network connection'
      ]
    }, { status: error.response?.status || 500 });
  }
}
