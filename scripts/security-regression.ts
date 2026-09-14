import assert from 'node:assert/strict';
import { sanitizeHtml, trustedFileUrl } from '../src/utils/security';

const page = 'https://oa.example.com/login';
const bases = ['https://api.example.com/shouhuiApi'];
for (const source of ['https://evil.example.com/a', 'https://api.example.com.evil.com/shouhuiApi/a', 'https://api.example.com/shouhuiApi-other/a', 'https://api.example.com/shouhuiApi/../private']) {
  assert.equal(trustedFileUrl(source, page, bases).trusted, false);
}
assert.equal(trustedFileUrl('https://api.example.com/shouhuiApi/sys/common/static/a.pdf', page, bases).trusted, true);
assert.equal(trustedFileUrl('/shouhuiApi/a', page, ['/shouhuiApi']).trusted, true);
for (const source of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:pass@api.example.com/shouhuiApi/a']) {
  assert.throws(() => trustedFileUrl(source, page, bases));
}
const cleaned = sanitizeHtml('<script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a><svg onload="alert(1)"></svg>');
assert.doesNotMatch(cleaned, /<script|onerror|javascript:|<svg|onload/i);
assert.equal(sanitizeHtml('<p><strong>正常内容</strong></p>'), '<p><strong>正常内容</strong></p>');
console.log('Security regression assertions passed');
