export type Achievement = {id: string; name: string; description: string};

const achievements = [
  {id: 'first-case', name: '초보 탈출!', description: '처음으로 시나리오를 모두 클리어했다.', completed: 1, clears: 0},
  {id: 'first-truth', name: '진실을 찾은 자', description: '처음으로 범인을 정확하게 지목했다.', completed: 0, clears: 1},
  {id: 'five-cases', name: '다섯 번의 밤', description: '시나리오를 5회 끝까지 플레이했다.', completed: 5, clears: 0},
] as const;

export function earnedAchievements(completed: number, clears: number): Achievement[] {
  return achievements.filter(item => completed >= item.completed && clears >= item.clears)
    .map(({id, name, description}) => ({id, name, description}));
}
