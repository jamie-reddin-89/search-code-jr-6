const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Expected application/json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const name = (body.name || "").toString().trim();
    const email = (body.email || "").toString().trim();
    const subject = (body.subject || "").toString().trim();
    const message = (body.message || "").toString().trim();

    if (!name || !email || !subject || !message) {
      return new Response(JSON.stringify({ error: "All fields (name, email, subject, message) are required." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    const SENDGRID_FROM = Deno.env.get("SENDGRID_FROM") || "no-reply@localhost";
    const CONTACT_TO = Deno.env.get("CONTACT_TO") || "jayreddin@hotmail.com";

    if (!SENDGRID_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured. Please set SENDGRID_API_KEY." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build SendGrid payload
    const sendgridPayload = {
      personalizations: [
        {
          to: [{ email: CONTACT_TO }],
          subject: subject,
        },
      ],
      from: { email: SENDGRID_FROM, name: name || "Contact Form" },
      content: [
        {
          type: "text/plain",
          value: `${message}\n\n---\nFrom: ${name} <${email}>`,
        },
      ],
    };

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendgridPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("SendGrid error:", res.status, text);
      return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Optionally store message in Supabase table if service role is available
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ name, email, subject, message, created_at: new Date().toISOString() }),
        });
      } catch (err) {
        console.warn("Failed to store contact message in Supabase:", err);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in contact-send function:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
