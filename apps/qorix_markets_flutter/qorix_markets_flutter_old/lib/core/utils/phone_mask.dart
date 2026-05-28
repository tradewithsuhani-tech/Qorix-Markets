/// Masks raw phone numbers for display (backend sends full phone on /v1/user/profile).
String maskPhone(String raw) {
  final phone = raw.trim();
  if (phone.length <= 4) return phone;

  final last4 = phone.substring(phone.length - 4);
  if (phone.startsWith('+')) {
    final prefixEnd = phone.length > 5 ? 3 : 2;
    return '${phone.substring(0, prefixEnd)} ******$last4';
  }
  return '******$last4';
}
