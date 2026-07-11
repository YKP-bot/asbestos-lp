<?php
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.html#contact');
    exit;
}

$to = 'kagawa.yuya.fr@gmail.com';
$subject = '【アスベスト調査LP】無料相談フォームからのお問い合わせ';

function post_value($key) {
    return trim((string)($_POST[$key] ?? ''));
}

$company = post_value('company');
$name = post_value('name');
$tel = post_value('tel');
$email = post_value('email');
$building = post_value('building');
$contact_method = post_value('contact_method');
$message = post_value('message');
$privacy_agree = isset($_POST['privacy_agree']) ? '同意済み' : '未同意';

if ($name === '' || $tel === '' || $email === '' || $building === '' || $contact_method === '' || !isset($_POST['privacy_agree'])) {
    header('Location: index.html#contact');
    exit;
}

$body = <<<EOT
無料相談フォームからお問い合わせがありました。

会社名：
{$company}

ご担当者名：
{$name}

電話番号：
{$tel}

メールアドレス：
{$email}

建物の種類：
{$building}

ご希望の連絡方法：
{$contact_method}

ご相談内容：
{$message}

プライバシーポリシー：
{$privacy_agree}
EOT;

$safe_email = filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : 'no-reply@example.com';
$headers = [
    'From: no-reply@example.com',
    'Reply-To: ' . $safe_email,
    'Content-Type: text/plain; charset=UTF-8',
];

mb_language('Japanese');
mb_internal_encoding('UTF-8');

$sent = mb_send_mail($to, $subject, $body, implode("\r\n", $headers));

header('Location: index.html?sent=' . ($sent ? '1' : '0') . '#contact');
exit;
