// Importa o hash (para gerar fingerprint único)
import xxhash from 'xxhash-wasm';

// PRECISA VER ISSO DE NAO TA SALVANDO EM BANCO DE DADOS DE RESTO PARECE QUE VAI FUNCIONAR
// PEGAR CODIGO QUE AJEITA O  / FICAR COMO INDEX E DEPOIS CONFIGURAR BINDING DOS FINGERPRINT

// Inicializa o WASM e extrai h64
const { h64 } = await xxhash();

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// se a rota é raiz captura o fingerprint
		if (path === '/capture' && method === 'POST') {
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
	// Bloco inicial para obter dados (sem alterações)
	const ip = request.headers.get('CF-Connecting-IP') || 'Unknown IP';
	const userAgent = request.headers.get('User-Agent') || 'Unknown User-Agent';
	const country = request.cf?.country ?? 'Unknown Country';
	const colo = request.cf?.colo ?? 'Unknown Colo';
	const tlsVersion = request.cf?.tlsVersion ?? 'Unknown TLS Version';
	const tlsCipher = request.cf?.tlsCipher ?? 'Unknown TLS Cipher';
	const ja3Hash = request.cf?.clientJA3Hash ?? 'Unknown JA3 Hash';

	const workerDataToHash = `${ip}|${userAgent}|${ja3Hash}|${country}|${colo}|${tlsVersion}|${tlsCipher}`;
	const workerHash = h64(workerDataToHash).toString(16);

	const frontData = await request.json();
	const frontHash = h64(JSON.stringify(frontData)).toString(16);
	const captureHash = h64(workerHash + frontHash).toString(16);

	// Prepare stmt para inserir no DB - NOMES DAS COLUNAS CORRIGIDOS
	const stmt = env.DB.prepare(`
        INSERT INTO fingerprints (
            timestamp, ip, userAgent, country, colo, tlsVersion, tlsCipher, ja3Hash,
            workerHash, frontHash, captureHash,
            frontUserAgent, frontLanguage, frontPlatform,
            frontScreenWidth, frontScreenHeight, frontColorDepth,
            frontTimezone, frontPlugins, frontCookiesEnabled,
            frontLocalStorage, frontSessionStorage, frontDoNotTrack,
            frontHardwareConcurrency, frontDeviceMemory, frontCanvas,
            frontFonts, frontWebGLVendor, frontWebGLRenderer,
            frontWebGLPixelSum, frontWebGLShaderSum,
            frontMediaAudio, frontMediaVideo,
            frontTouchMaxTouchPoints, frontTouchPointerPrecision,
            frontBatteryLevel, frontBatteryCharging,
            frontBatteryChargingTime, frontBatteryDischargingTime,
            frontAudioFingerprint
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
        )
    `);

	// Bind dos valores (sem alterações na lógica, apenas na ordem para corresponder ao INSERT)
	await stmt
		.bind(
			new Date().toISOString(),
			ip,
			userAgent,
			country,
			colo,
			tlsVersion,
			tlsCipher,
			ja3Hash,
			workerHash,
			frontHash,
			captureHash,
			frontData.userAgent ?? null,
			frontData.language ?? null,
			frontData.platform ?? null,
			frontData.screen?.width ?? null,
			frontData.screen?.height ?? null,
			frontData.screen?.colorDepth ?? null,
			frontData.timezone ?? null,
			JSON.stringify(frontData.plugins ?? []),
			frontData.cookiesEnabled ?? null,
			frontData.localStorage ?? null,
			frontData.sessionStorage ?? null,
			frontData.doNotTrack ?? null,
			frontData.hardwareConcurrency ?? null,
			frontData.deviceMemory ?? null,
			frontData.canvas ?? null,
			JSON.stringify(frontData.fonts ?? []),
			frontData.webglAdvanced?.vendor ?? null,
			frontData.webglAdvanced?.renderer ?? null,
			frontData.webglAdvanced?.pixelSum ?? null,
			frontData.webglAdvanced?.shaderSum ?? null,
			frontData.mediaCapabilities?.audio ? JSON.stringify(frontData.mediaCapabilities.audio) : null,
			frontData.mediaCapabilities?.video ? JSON.stringify(frontData.mediaCapabilities.video) : null,
			frontData.touch?.maxTouchPoints ?? null,
			frontData.touch?.pointerPrecision ?? null,
			frontData.battery?.level ?? null,
			frontData.battery?.charging ?? null,
			frontData.battery?.chargingTime ?? null,
			frontData.battery?.dischargingTime ?? null,
			frontData.audioFingerprint ?? null
		)
		.run();

	return new Response(JSON.stringify({ status: 'ok', captureHash }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
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
		headers: { 'WWW-Authenticate': 'Basic realm="Área Administrativa da API"' }, //testa e retorna se deve dar um gatekeeping ou nao
	});
}
