import 'dart:convert';
import 'dart:io';

import 'package:image_picker/image_picker.dart';

abstract final class KycImageHelper {
  static final _picker = ImagePicker();

  static Future<String?> pickDataUrl() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 2048,
      imageQuality: 82,
    );
    if (file == null) return null;
    final bytes = await File(file.path).readAsBytes();
    if (bytes.length > 4 * 1024 * 1024) {
      throw StateError('Image must be under 4 MB');
    }
    final mime = _mimeForPath(file.path);
    return 'data:$mime;base64,${base64Encode(bytes)}';
  }

  static String _mimeForPath(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
