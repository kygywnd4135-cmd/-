export const NICKNAME_CHANGE_INTERVAL = 7 * 24 * 60 * 60 * 1000;

export const nicknameMessages = {
 taken: '앗! 이미 사용중인 닉네임입니다.\n다시 한번 확인해주세요.',
 restricted: '비속어나 특정 성향을 강조한 닉네임은\n사용할 수 없습니다!',
 format: '닉네임은 한글·영문·숫자 2~12자로 입력해주세요.\n공백과 특수문자는 사용할 수 없습니다.',
 cooldown: '닉네임은 일주일에 한 번만 변경할 수 있습니다.\n다음 변경 가능일에 다시 시도해주세요.',
} as const;

export function normalizeNickname(value: unknown): string {
 return typeof value === 'string' ? value.normalize('NFKC') : '';
}

// Explicit terms only: the filter checks nickname text, never a user's identity.
const restrictedTerms = [
 '시발','씨발','씨빨','씨바','씨팔','시팔','ㅅㅂ','ㅆㅂ','병신','븅신','ㅂㅅ','ㅄ',
 '지랄','좆','씹','개새끼','새끼','fuck','shit','bitch',
 '일베','일간베스트','ilbe','페미니스트','feminist',
].map(term => term.normalize('NFKC').toLocaleLowerCase('en-US'));

export function getNicknameIssue(value: unknown): null | 'format' | 'restricted' {
 const nickname = normalizeNickname(value);
 if (Array.from(nickname).length < 2 || Array.from(nickname).length > 12 || !/^[\p{Script=Hangul}A-Za-z0-9]+$/u.test(nickname)) return 'format';
 const comparable = nickname.toLocaleLowerCase('en-US');
 return restrictedTerms.some(term => comparable.includes(term)) ? 'restricted' : null;
}
