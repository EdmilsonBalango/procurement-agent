const webhookUrl = 'https://n8n.karingani.com/webhook/a379f74d-57f1-4b35-a843-35a013f4455a';
// const webhookUrl_test = 'https://n8n.karingani.com/webhook-test/a379f74d-57f1-4b35-a843-35a013f4455a';

export type EmailWebhookPayload = {
  type:
    | 'PR_ASSIGNMENT_NOTIFICATION'
    | 'QUOTES_FOR_REVIEW'
    | 'REQUEST_QUOTES'
    | 'REQUEST_INVOICE'
    | 'USER_CREDENTIALS';
  html: string;
  messageID: string;
  to?: string[];
  suppliers?: string[];
  subject?: string;
  quoteFiles?: Array<{
    quoteId: string;
    fileId: string;
    filename: string;
    mimeType: string;
    contentBase64: string;
  }>;
  poFiles?: Array<{
    fileId: string;
    filename: string;
    mimeType: string;
    contentBase64: string;
  }>;
};

export type PopWebhookPayload = {
  type: 'SEND_POP';
  subject: string;
  message: string;
  data: Array<{
    supplier: {
      name: string;
      emailAddress: string;
    };
    pop: {
      filename: string;
      mimeType: string;
      contentBase64: string;
    };
  }>;
};

export async function forwardEmailToWebhook(payload: EmailWebhookPayload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: responseText,
  };
}

export async function forwardPopToWebhook(payload: PopWebhookPayload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: responseText,
  };
}
