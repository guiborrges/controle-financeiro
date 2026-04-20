# Checklist de deploy no Render

## Antes de subir

- Confirmar que `render.yaml` está no repositório.
- Confirmar que `NODE_ENV=production` e `FIN_STORAGE_DIR=/var/data/controle-financeiro` estão definidos.
- Confirmar que existe um `FIN_SESSION_SECRET` forte.
- Fazer backup inicial de `auth/` e `data/`.

## No painel do Render

- Verificar que o serviço foi criado como `Web Service` Node.
- Verificar que o disco persistente existe.
- Verificar que o disco está montado em `/var/data`.
- Verificar que a variável `FIN_STORAGE_DIR` está em `/var/data/controle-financeiro`.
- Verificar que a variável `FIN_SESSION_SECRET` está definida.

## Teste manual após o deploy

1. Abrir `/login`.
2. Testar login com a conta principal.
3. Fechar sessão e testar `Continuar logado` marcado e desmarcado.
4. Criar um usuário novo.
5. Confirmar que o usuário novo abre limpo e sem `Fechamentos ESO`.
6. Criar um mês no usuário novo e confirmar que nada aparece no `guilherme`.
7. Alterar um `Pago` em despesas e recarregar a página.
8. Alterar `Dados da pessoa` e salvar.
9. Fazer logout e login novamente.
10. Confirmar que os dados persistiram.

11. Confirmar que os arquivos legados da raiz nao serao publicados nem usados no deploy.
