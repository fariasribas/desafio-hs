// Importa o hash (para gerar fingerprint único)
import xxhash from 'xxhash-wasm';

// Inicializa o WASM e extrai h64
const { h64 } = await xxhash();

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// Quando alguém acessa a raiz, já captura fingerprint e salva
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
 * Captura fingerprint automaticamente ao acessar a raiz "/"
 */
async function handleCaptureFingerprint(request, env) {
	const ip = request.headers.get('CF-Connecting-IP') || 'Unknown IP';
	const userAgent = request.headers.get('User-Agent') || 'Unknown User-Agent';
	const country = request.cf?.country ?? 'Unknown Country';
	const colo = request.cf?.colo ?? 'Unknown Colo';
	const tlsVersion = request.cf?.tlsVersion ?? 'Unknown TLS Version';
	const tlsCipher = request.cf?.tlsCipher ?? 'Unknown TLS Cipher';
	const ja3Hash = request.cf?.clientJA3Hash ?? 'Unknown JA3 Hash';

	const dataToHash = `${ip}|${userAgent}|${ja3Hash}|${country}|${tlsVersion}|${tlsCipher}`;
	const fingerprintHash = h64(dataToHash).toString(16);

	try {
		const stmt = env.DB.prepare(
			`INSERT INTO fingerprints (timestamp, ip, userAgent, country, colo, tlsVersion, tlsCipher, ja3Hash, fingerprintHash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);

		await stmt.bind(new Date().toISOString(), ip, userAgent, country, colo, tlsVersion, tlsCipher, ja3Hash, fingerprintHash).run();

		// Aqui você pode devolver algo visível no browser
		return new Response('200', {
			status: 200,
			headers: { 'Content-Type': 'text/plain' },
		});
	} catch (e) {
		console.error('Erro no D1:', e);
		return new Response(JSON.stringify({ error: `Erro ao salvar no banco: ${e.message}` }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Lista fingerprints capturados (rota protegida)
 */
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
		return showAuthPopup('Credenciais inválidas.');
	}

	try {
		const stmt = env.DB.prepare('SELECT * FROM fingerprints ORDER BY timestamp DESC LIMIT 100');
		const { results } = await stmt.all();
		return new Response(JSON.stringify(results, null, 2), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e) {
		console.error('Erro no D1:', e);
		return new Response(JSON.stringify({ error: `Erro ao buscar no banco: ${e.message}` }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Auxiliar de autenticação
 */
function showAuthPopup(message = 'Acesso restrito.') {
	return new Response(message, {
		status: 401,
		headers: { 'WWW-Authenticate': 'Basic realm="Área Administrativa da API"' },
	});
}
