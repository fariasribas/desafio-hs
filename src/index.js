// Importa o hash (para gerar fingerprint único)
import xxhash from 'xxhash-wasm';

// Inicializa o WASM e extrai h64
const { h64 } = await xxhash();

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// se a rota é raiz captura o fingerprint
		if (path === '/' && method === 'GET') {
			return await handleCaptureFingerprint(request, env);
		}

		// Rota de administração (com autenticação básica)
		if (path === '/admin' && method === 'GET') {
			return await handleListFingerprints(request, env);
		}

		return new Response(JSON.stringify({ error: 'Not Found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	},
};

/**
 * captura e cria um json do fingerprint, além de criar a hash usando xxhash
 */
async function handleCaptureFingerprint(request, env) {
	const ip = request.headers.get('CF-Connecting-IP') || 'Unknown IP';
	const userAgent = request.headers.get('User-Agent') || 'Unknown User-Agent';
	const country = request.cf?.country ?? 'Unknown Country';
	const colo = request.cf?.colo ?? 'Unknown Colo';
	const tlsVersion = request.cf?.tlsVersion ?? 'Unknown TLS Version';
	const tlsCipher = request.cf?.tlsCipher ?? 'Unknown TLS Cipher';
	const ja3Hash = request.cf?.clientJA3Hash ?? 'Unknown JA3 Hash'; // isso só vai funcionar com cloudflare enterprise ou bot management, mantive como um inclemento.

	const dataToHash = `${ip}|${userAgent}|${ja3Hash}|${country}|${tlsVersion}|${tlsCipher}`;
	const fingerprintHash = h64(dataToHash).toString(16); // isso é uma hash simples e veloz, não é criptografada.

	try {
		const stmt = env.DB.prepare(
			`INSERT INTO fingerprints (timestamp, ip, userAgent, country, colo, tlsVersion, tlsCipher, ja3Hash, fingerprintHash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` // faz requisição sql para o DB e insere os dados.
		);

		await stmt.bind(new Date().toISOString(), ip, userAgent, country, colo, tlsVersion, tlsCipher, ja3Hash, fingerprintHash).run(); // seta a hora do fingerprint em UTC.

		// mostra apenas status 200 ao pegar fingerprint, pode ser feito um front-end encima disso.
		return new Response('200', {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e) {
		console.error('Erro no D1:', e); // teste se está salvando no banco de dados
		return new Response(JSON.stringify({ error: `Erro ao salvar no banco: ${e.message}` }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleListFingerprints(request, env) {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		return showAuthPopup();
	}
	const [scheme, encoded] = authHeader.split(' ');
	if (scheme !== 'Basic' || !encoded) {
		return showAuthPopup();
	}
	const [user, pass] = atob(encoded).split(':');
	if (user !== env.ADMIN_USER || pass !== env.ADMIN_PASS) {
		return showAuthPopup('Credenciais inválidas.'); // testa autenticação no endpoit admin
	}

	try {
		const stmt = env.DB.prepare('SELECT * FROM fingerprints ORDER BY timestamp DESC LIMIT 100');
		const { results } = await stmt.all();
		return new Response(JSON.stringify(results, null, 2), {
			headers: { 'Content-Type': 'application/json' }, // caso esteja logado entrega ordenado os fingerprints
		});
	} catch (e) {
		console.error('Erro de busca no D1:', e); // teste de erro ao buscar no banco
		return new Response(JSON.stringify({ error: `Erro ao buscar no banco: ${e.message}` }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

function showAuthPopup(message = 'Acesso restrito.') {
	return new Response(message, {
		status: 401,
		headers: { 'WWW-Authenticate': 'Basic realm="Área Administrativa da API"' },
	});
}
