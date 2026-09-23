// netlify/functions/send-to-48hr.js
//
// Ce fichier est un "relais" sécurisé entre le site (navigateur du client ou
// de la gérante) et l'API de 48HR Livraison (plateforme Ecotrack).
//
// Pourquoi ce fichier est nécessaire :
// Le jeton API (API token) de 48HR ne doit JAMAIS être visible dans le code
// du site (index.html / admin.html), car n'importe quel visiteur pourrait
// l'y lire et l'utiliser pour créer des commandes sur votre compte.
// Ce fichier tourne sur le serveur de Netlify, jamais dans le navigateur,
// donc le jeton y reste caché.
//
// Configuration requise (à faire une seule fois) :
// Dans le tableau de bord Netlify de ce site → Site configuration →
// Environment variables → ajouter une variable nommée
//   ECOTRACK_API_TOKEN
// avec pour valeur le jeton API donné par 48HR.
// Puis redéployer le site pour que la variable soit prise en compte.

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée." }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const token = process.env.ECOTRACK_API_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({
        error:
          "ECOTRACK_API_TOKEN n'est pas configuré sur le serveur. Ajoutez-le dans Netlify → Environment variables."
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Corps de requête invalide." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const {
    reference,
    nomClient,
    telephone,
    telephone2,
    adresse,
    codePostal,
    commune,
    codeWilaya,
    montant,
    remarque,
    produit,
    stock,
    quantite,
    produitARecuperer,
    boutique,
    type,
    stopDesk,
    weight,
    fragile,
    gpsLink
  } = body || {};

  if (!nomClient || !telephone || !adresse || !commune || !codeWilaya || montant === undefined || montant === null) {
    return new Response(
      JSON.stringify({ error: "Champs obligatoires manquants (nom, téléphone, adresse, commune, wilaya, montant)." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const payload = {
    reference,
    nom_client: nomClient,
    telephone,
    telephone_2: telephone2,
    adresse,
    code_postal: codePostal,
    commune,
    code_wilaya: Number(codeWilaya),
    montant: Number(montant),
    remarque,
    produit,
    stock: stock !== undefined ? Number(stock) : undefined,
    quantite,
    produit_a_recuperer: produitARecuperer,
    boutique,
    type: type ? Number(type) : 1, // 1 = Livraison par défaut
    stop_desk: stopDesk !== undefined ? Number(stopDesk) : 0, // 0 = à domicile par défaut
    weight,
    fragile: fragile !== undefined ? Number(fragile) : undefined,
    gps_link: gpsLink
  };

  // Retirer les champs vides/undefined pour ne pas gêner la validation côté 48HR
  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined || payload[k] === null || payload[k] === "") delete payload[k];
  });

  try {
    const res = await fetch("https://48hr.ecotrack.dz/api/v1/create/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: data.message || `Erreur 48HR (HTTP ${res.status}).`,
          details: data.errors || null
        }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Impossible de contacter le serveur de 48HR.", details: String(err) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/send-to-48hr"
};
