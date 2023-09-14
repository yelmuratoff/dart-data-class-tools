import 'dart:convert';

import 'package:collection/collection.dart';
import 'package:flutter/material.dart';

enum Payment { pix, credit }

class Test {
  final List<String>? members; //  // toCustom is optional.
  final Map<String, dynamic> address;
  final Payment paymentType; // enum // comment
  final List<Color>? date;
  // final Timestamp? time; // ignore
  final String? name;
  final bool? isPremium;
  final IconData icon;
  final Color? color;
  final int id;
  final double? radius;
  Test({
    this.members,
    required this.address,
    required this.paymentType,
    this.date,
    this.name,
    this.isPremium,
    required this.icon,
    this.color,
    required this.id,
    this.radius,
  });






  String toJson() => json.encode(toMap());

  factory Test.fromJson(String source) => Test.fromMap(json.decode(source));

  @override
  String toString() {
    return 'Test(members: $members, address: $address, paymentType: $paymentType, date: $date, name: $name, isPremium: $isPremium, icon: $icon, color: $color, id: $id, radius: $radius)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    final collectionEquals = const DeepCollectionEquality().equals;
  
    return other is Test &&
        collectionEquals(other.members, members) &&
        collectionEquals(other.address, address) &&
        other.paymentType == paymentType &&
        collectionEquals(other.date, date) &&
        other.name == name &&
        other.isPremium == isPremium &&
        other.icon == icon &&
        other.color == color &&
        other.id == id &&
        other.radius == radius;
  }

  @override
  int get hashCode {
    return members.hashCode ^
        address.hashCode ^
        paymentType.hashCode ^
        date.hashCode ^
        name.hashCode ^
        isPremium.hashCode ^
        icon.hashCode ^
        color.hashCode ^
        id.hashCode ^
        radius.hashCode;
  }

  Map<String, dynamic> toMap() {
    return {
      'members': members,
      'address': address,
      'paymentType': paymentType.index,
      'date': date?.map((x) => x.value).toList(),
      'name': name,
      'isPremium': isPremium,
      'icon': icon.codePoint,
      'color': color?.value,
      'id': id,
      'radius': radius,
    };
  }

  Test copyWith({
    List<String>? members,
    Map<String, dynamic>? address,
    Payment? paymentType,
    List<Color>? date,
    String? name,
    bool? isPremium,
    IconData? icon,
    Color? color,
    int? id,
    double? radius,
  }) {
    return Test(
      members: members ?? this.members,
      address: address ?? this.address,
      paymentType: paymentType ?? this.paymentType,
      date: date ?? this.date,
      name: name ?? this.name,
      isPremium: isPremium ?? this.isPremium,
      icon: icon ?? this.icon,
      color: color ?? this.color,
      id: id ?? this.id,
      radius: radius ?? this.radius,
    );
  }

  factory Test.fromMap(Map<String, dynamic> map) {
    T isA<T>(k) => map[k] is T ? map[k] : throw ArgumentError.value(map[k], k);
    return Test(
      members: map['members'] != null
          ? List<String>.from(isA<Iterable<String>>('members'))
          : null,
      address: Map<String, dynamic>.from(isA<Map<String, dynamic>>('address')),
      paymentType: Payment.values[isA<num>('paymentType').toInt()],
      date: map['date'] != null
          ? List<Color>.from(isA<Iterable>('date').map((x) => Color(x)))
          : null,
      name: isA<String?>('name'),
      isPremium: isA<bool?>('isPremium'),
      icon: IconData(isA<num>('icon').toInt(), fontFamily: 'MaterialIcons'),
      color: map['color'] != null ? Color(isA<num>('color').toInt()) : null,
      id: isA<int>('id'),
      radius: isA<double?>('radius'),
    );
  }
}
