#!/bin/bash
git add .
read -p "Digite a mensagem do commit: " mensagem
git commit -m "$mensagem"
git push origin main
echo "Feito! O GitHub Actions vai assumir o deploy agora."
sleep 3