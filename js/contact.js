const EMAILJS_PUBLIC_KEY = "wlsx4npEJ5ho8n9a5";
const EMAILJS_SERVICE_ID = "service_o6qwngk";
const EMAILJS_TEMPLATE_ID = "template_8ksvv0d";

if (window.emailjs) window.emailjs.init(EMAILJS_PUBLIC_KEY);

const contactForm = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');

contactForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = [...contactForm.querySelectorAll('input, textarea')];
    fields.forEach((field) => field.closest('.field')?.classList.toggle('field--invalid', !field.validity.valid));
    const firstInvalid = fields.find((field) => !field.validity.valid);
    if (firstInvalid) {
        firstInvalid.focus();
        formStatus.textContent = '필수 항목을 확인해 주세요.';
        formStatus.dataset.state = 'error';
        return;
    }

    const submitButton = contactForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.querySelector('span').textContent = 'Sending...';
    formStatus.textContent = '문의 내용을 보내고 있습니다.';
    formStatus.dataset.state = 'pending';

    try {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            from_name: document.getElementById('contact-name').value,
            reply_to: document.getElementById('contact-reply').value,
            subject: '홈페이지 문의',
            message: document.getElementById('contact-message').value
        });
        contactForm.reset();
        formStatus.textContent = '문의가 전송되었습니다. 확인 후 연락드리겠습니다.';
        formStatus.dataset.state = 'success';
    } catch (error) {
        console.error('Contact form failed', error);
        formStatus.textContent = '전송에 실패했습니다. 이메일로 직접 문의해 주세요.';
        formStatus.dataset.state = 'error';
    } finally {
        submitButton.disabled = false;
        submitButton.querySelector('span').textContent = 'Send inquiry';
    }
});

contactForm?.addEventListener('input', (event) => {
    const field = event.target.closest('input, textarea');
    if (field?.validity.valid) field.closest('.field')?.classList.remove('field--invalid');
});
