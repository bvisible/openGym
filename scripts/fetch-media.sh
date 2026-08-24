#!/usr/bin/env bash
#//// Neoffice — adapté : les médias vont dans opengym/public/media/ (servi par
#//// Frappe sur /assets/opengym/media/) au lieu de ./media, et le script est
#//// idempotent pour pouvoir tourner au provisioning.
#////
#//// ⚠️ LIRE AVANT DE LANCER ÇA SUR UNE INSTANCE CLIENTE.
#//// Ces 1 324 GIF et JPG sont © Gym visual. Le dépôt du jeu de données a une
#//// permission écrite pour les redistribuer ; NOUS N'EN AVONS PAS. Les servir
#//// à des membres d'un club qui paie est une redistribution commerciale, et
#//// leur licence l'interdit sans accord spécifique ("on-demand services",
#//// "products destined for resale").
#////
#//// Donc : ce script est fait pour le DÉVELOPPEMENT et la démonstration
#//// interne. Avant une mise en service chez un client, trancher — le club
#//// achète son pack à son nom (~0,90 $ le mouvement, 160-320 CHF pour une
#//// salle), ou on bascule sur des photos du domaine public.
#//// Détail : Obsidian, Neoffice/Fitness-Coaching/02-Licences-Et-Contraintes.
set -euo pipefail
cd "$(dirname "$0")/.."

DEST="opengym/public/media"
mkdir -p "$DEST/img" "$DEST/gif"

if [ -n "$(ls -A "$DEST/img" 2>/dev/null)" ]; then
  echo "✓ Médias déjà présents ($(ls "$DEST/img" | wc -l | tr -d ' ') images) — rien à faire."
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "↓ Téléchargement des médias d'exercices (~140 Mo, une seule fois)…"
git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset "$tmp"
cp "$tmp"/images/*.jpg "$DEST/img/"
cp "$tmp"/videos/*.gif "$DEST/gif/"
echo "✓ $(ls "$DEST/img" | wc -l | tr -d ' ') images, $(ls "$DEST/gif" | wc -l | tr -d ' ') animations."
echo "  © Gym visual — https://gymvisual.com/ (attribution obligatoire, 180×180)"
