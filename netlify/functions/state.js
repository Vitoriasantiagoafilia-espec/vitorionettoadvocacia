// state.js — backend compartilhado do Portal Kivor / Vitório Netto Advocacia
const { getStore, connectLambda } = require('@netlify/blobs');

const STORE_NAME = 'portal-state';
const KEY = 'state';
const PIPELINE_STAGES = ['criacao', 'programado', 'concluido'];

const EMPTY_STATE = { approvals: {}, production: {}, finalApproval: null, updatedAt: null };

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  const store = getStore(STORE_NAME);

  try {
    if (event.httpMethod === 'GET') {
      const data = (await store.get(KEY, { type: 'json' })) || EMPTY_STATE;
      return json(200, data);
    }

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'JSON inválido no corpo da requisição.' });
    }

    const current = (await store.get(KEY, { type: 'json' })) || {
      approvals: {},
      production: {},
      finalApproval: null,
      updatedAt: null,
    };
    if (!current.production) current.production = {};

    if (payload.type === 'item') {
      const { id, status, comment } = payload;
      if (!id) return json(400, { error: 'id é obrigatório.' });
      current.approvals[id] = {
        status: status || 'pendente',
        comment: typeof comment === 'string' ? comment : '',
        ts: Date.now(),
      };
    } else if (payload.type === 'production') {
      const { id, stage, date } = payload;
      if (!id) return json(400, { error: 'id é obrigatório.' });
      if (!PIPELINE_STAGES.includes(stage)) {
        return json(400, { error: "stage deve ser 'criacao', 'programado' ou 'concluido'." });
      }
      current.production[id] = {
        stage,
        date: typeof date === 'string' ? date : '',
        ts: Date.now(),
      };
    } else if (payload.type === 'final') {
      current.finalApproval = {
        nome: payload.nome || '',
        cargo: payload.cargo || '',
        data: payload.data || '',
        assinaturaDataUrl: payload.assinaturaDataUrl || '',
        status: payload.status || 'aprovado',
        changesText: payload.changesText || '',
        ts: Date.now(),
      };
    } else {
      return json(400, { error: "Campo 'type' deve ser 'item', 'production' ou 'final'." });
    }

    current.updatedAt = Date.now();
    await store.setJSON(KEY, current);
    return json(200, current);
  }

  return json(405, { error: 'Método não suportado.' });
  } catch (err) {
    return json(500, { error: err && err.message ? err.message : 'Erro interno.' });
  }
};
