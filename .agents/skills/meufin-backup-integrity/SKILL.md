---
name: meufin-backup-integrity
description: Validar backups, restore, integridade e migracoes do MeuFin em storage isolado, considerando JSON particionado padrao e SQLite opcional.
---

# Integridade e recuperacao

Comece por `server/paths.js`, `state-store-factory.js`, `app-state-store.js`,
`backup-store.js`, `fs-atomic.js` e `services/backup-service.js`.
JSON particionado e o padrao. SQLite somente e escolhido por
`FIN_STATE_BACKEND=sqlite` quando disponivel, com mirror JSON. Nao habilite SQLite
nem afirme que ele e usado online sem conferir configuracao autorizada.

Mapeie o bundle completo, particoes aninhadas, ownership, checksums e chaves
necessarias para ler estado criptografado. Um arquivo raiz integro nao prova
que as particoes existem. Nao registre segredos em relatorio ou fixture.
Backup e por usuario; ID de backup deve ser validado e pertencer ao dono.

Restore JSON e substituicao, nao merge; a publicacao de revisao nova e rejeicao
de abas antigas e caracterizada nesse caminho. Para SQLite, trate revisao/restore
como requisitos a conferir, nao como garantias ja equivalentes ao JSON.
Copiar app-state ignorando o backend ativo pode deixar SQLite e
JSON divergentes; verifique os testes e ressalvas antes de propor recuperacao.
Nunca restaure producao apenas para testar. Exija autorizacao especifica,
backup anterior confirmado, destino identificado e plano de recuperacao.

Use `FIN_STORAGE_DIR` em pasta temporaria com dois usuarios sinteticos; cubra
plain/encrypted/partitioned, particao ausente, checksum invalido, backup alheio,
retencao/ancoras mensais, falha atomica e conflito de revisao. Confirme efeitos
sobre integracoes/patrimonio sem reintroduzir residuos do snapshot substituido.
Nao crie backups pesados durante simples navegacao de meses virtuais.

Testes: `backup-isolation-integration`, `app-state-read-write`, `state-store-sqlite`,
`state-commit-safety`, `refactor-state-roundtrip`, `profile-auto-exit-backup`.
Relate backend efetivamente testado, revisoes antes/depois, contagens e limites.
Testes de SQLite indisponiveis devem constar como nao executados, nao aprovados.
