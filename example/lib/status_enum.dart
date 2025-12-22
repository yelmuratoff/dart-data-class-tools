enum QuizStatusEnum {
  inactive,
  active,
  finish,
  superGameActive,
  superGameFinish;

  bool get isInactive => this == QuizStatusEnum.inactive;
  bool get isActive => this == QuizStatusEnum.active;
  bool get isFinish => this == QuizStatusEnum.finish;
  bool get isSuperGameActive => this == QuizStatusEnum.superGameActive;
  bool get isSuperGameFinish => this == QuizStatusEnum.superGameFinish;

  static QuizStatusEnum parse(String value) => switch (value) {
        'inactive' => QuizStatusEnum.inactive,
        'active' => QuizStatusEnum.active,
        'finish' => QuizStatusEnum.finish,
        'super_game_active' => QuizStatusEnum.superGameActive,
        'super_game_finish' => QuizStatusEnum.superGameFinish,
        _ => throw Exception('Unknown value $value'),
      };

  String serialize() => switch (this) {
        QuizStatusEnum.inactive => 'inactive',
        QuizStatusEnum.active => 'active',
        QuizStatusEnum.finish => 'finish',
        QuizStatusEnum.superGameActive => 'super_game_active',
        QuizStatusEnum.superGameFinish => 'super_game_finish',
      };
}
