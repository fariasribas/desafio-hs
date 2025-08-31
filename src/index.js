export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// recebe rota do frontfingerprint e realiza o backfingerprinting (do worker)
		if (path === '/capture' && method === 'POST') {
			return await handleCaptureFingerprint(request, env);
		}

		// Rota de administração (com autenticação básica), para segurança interessante implementar JWT.
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
 * captura, cria e faz um insert no db do D1 do fingerprint.
 */
async function handleCaptureFingerprint(request, env) {
	// bloco do backfingerprint (o inicial, do worker mesmo), não necessita de front.
	const ip = request.headers.get('CF-Connecting-IP') || 'Unknown IP';
	const userAgent = request.headers.get('User-Agent') || 'Unknown User-Agent';
	const country = request.cf?.country ?? 'Unknown Country';
	const colo = request.cf?.colo ?? 'Unknown Colo';
	const tlsVersion = request.cf?.tlsVersion ?? 'Unknown TLS Version';
	const tlsCipher = request.cf?.tlsCipher ?? 'Unknown TLS Cipher';
	const ja3Hash = request.cf?.clientJA3Hash ?? 'Unknown JA3 Hash';
	// cria hash do backfingerprint concatenando os dados coletados
	const workerDataToHash = `${ip}|${userAgent}|${ja3Hash}|${country}|${colo}|${tlsVersion}|${tlsCipher}`;
	// hasheia usando sha256 para evitar colisao de hashes
	const workerHash = await createSha256Hash(workerDataToHash);
	// obtem json do front
	const frontData = await request.json();
	//cria uma hash do json do front em sha256
	const frontHash = await createSha256Hash(JSON.stringify(frontData));
	//concatena hashes de front e back e cria hash 256 unica de ambos.
	const captureHash = await createSha256Hash(workerHash + frontHash);

	// insere dados de front e back no DB do D1
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

	// declara e organiza itens do fingerprint json e do back
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
	// se tudo ok retorna 200, mantive para testes, pode ser alterado para retornar em terminalç
	return new Response(JSON.stringify({ status: 'ok', captureHash }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

//funcao para listar fingerprints apos logado e logar em si em /admin
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
//testa e retorna se deve dar um gatekeeping ou nao
function showAuthPopup(message = 'Acesso restrito.') {
	return new Response(message, {
		status: 401,
		headers: { 'WWW-Authenticate': 'Basic realm="Área Administrativa da API"' },
	});
}
// funcao simples para hashear em sha256
async function createSha256Hash(text) {
	const encoder = new TextEncoder();
	const data = encoder.encode(text);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	// Converte o buffer de bytes para uma string hexadecimal
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
