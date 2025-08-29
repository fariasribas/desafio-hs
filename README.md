Este projeto é um **Cloudflare Worker** que captura informações de fingerprint dos visitantes e as armazena em um banco de dados **D1**. Ele também oferece uma rota de administração protegida por **autenticação básica**, permitindo consultar os fingerprints armazenados.

## Funcionalidades

- Captura informações de fingerprint do visitante:
  - IP
  - User-Agent
  - País e colo do Cloudflare
  - Versão e cifra TLS
  - JA3 Hash (quando disponível)
  - Hash único gerado com `xxhash-wasm`
- Armazena os dados no banco D1.
- Rota de administração (`/admin`) protegida por **Basic Auth** para listar os últimos 100 fingerprints.

## Rotas

- `/` (GET)  
  Captura o fingerprint do visitante e salva no banco.

- `/admin` (GET)  
  Lista os últimos 100 fingerprints. Protegido por Basic Auth.
