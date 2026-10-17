// Turns the check and save results into the page's usual {success, data|error} reply.
var c = $('Check Message').first().json;
if (c.trap) return [{ json: { success: true, data: { saved: true } } }];
if (!c.valid) return [{ json: { success: false, error: { code: 'INVALID', message: c.message } } }];
var r = $input.first().json || {};
if (r.error || r.saved === undefined) return [{ json: { success: false, error: { code: 'ERROR', message: 'We could not send your message right now. Please try again in a few minutes.' } } }];
if (Number(r.saved) > 0 || r.dup === true) return [{ json: { success: true, data: { saved: true } } }];
return [{ json: { success: false, error: { code: 'LIMIT', message: 'We have had a lot of messages from your network today. Please try again tomorrow.' } } }];
