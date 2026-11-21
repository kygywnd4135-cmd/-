export const characters = [
 {name:'윤태오',age:24,major:'정치외교학과 4학년',job:'총학생회장',color:'#5b7fa0',quote:'우리가 지켜야 할 학교의 모습은 무엇일까요.',intro:'모두가 신뢰하는 학생회장. 개교 100주년 축제를 총괄한다. 다정한 태도 뒤에 학교와 가족을 향한 복잡한 마음을 감추고 있다.'},
 {name:'강서윤',age:23,major:'국어국문학과 4학년',job:'학보사 편집장',color:'#b57465',quote:'말보다 원본을 보여주세요.',intro:'학교의 어두운 곳을 취재하는 학보사 편집장. 구도서관 화재 사건에 관한 마지막 기사를 준비하고 있다.'},
 {name:'민재하',age:25,major:'전자공학과 4학년',job:'방송국 음향 담당',color:'#77799b',quote:'소리는 흔적을 남깁니다. 사람도 그럴까요.',intro:'말수가 적은 방송국 엔지니어. 복학 후 백야제 음향을 맡았다. 고장 난 장비를 고치는 데 익숙하지만 자신의 과거는 잘 이야기하지 않는다.'},
 {name:'한소민',age:24,major:'의학과 본과 1학년',job:'장학회 학생 대표',color:'#6d9691',quote:'알아야 하는 것과 공개해야 하는 것은 다를 수 있어요.',intro:'재단 장학금을 받는 우등생. 갈등을 중재하는 데 익숙하다. 축제에 참석한 이유에는 어머니의 부탁도 있었다.'},
 {name:'백시우',age:23,major:'연극영화과 3학년',job:'기념영상 감독',color:'#b88859',quote:'카메라는 계속 돌아가고 있었어요.',intro:'백야제 기념영상 감독. 긴장을 농담으로 감추는 버릇이 있다. 늘 곁에 둔 카메라가 그날 밤 뜻밖의 장면을 기록했다.'},
 {name:'오유진',age:24,major:'문헌정보학과 4학년',job:'기록관 근로학생',color:'#89916f',quote:'없어진 기록에는 없애기로 결정한 사람이 있어요.',intro:'개교 100주년 기록물을 정리하는 근로학생. 교수와 함께 오래된 문서를 조사했다. 문장 하나의 차이도 그냥 넘기지 않는다.'}
];
export const phases = [
 {name:'역할 확인',label:'당신의 이야기를 확인하세요',seconds:480,brief:'각자의 역할과 비밀을 확인해 주세요. 다른 학생의 비밀은 아직 알 수 없습니다.'},
 {name:'1차 조사',label:'모든 진술에는 빈틈이 있다',seconds:900,brief:'여섯 장소를 조사할 수 있습니다. 각자 단서 2개를 확보하고, 공개할 정보를 결정하세요.'},
 {name:'중간 토론',label:'들었다는 것은, 살아 있었다는 뜻일까',seconds:300,brief:'두 녹음의 기침과 종이 소리가 정확히 일치합니다. 22:55의 목소리는 예약 재생된 녹음입니다.'},
 {name:'2차 조사',label:'지워진 이름을 찾아서',seconds:900,brief:'추가 자료가 도착했습니다. 다시 2곳을 조사하세요. 시간 기록과 25년 전 문서를 비교해 주세요.'},
 {name:'최종 토론',label:'여섯 개의 비밀, 하나의 진실',seconds:720,brief:'수사에 필요한 원본을 증거보드에 공개했습니다. 공격 시점과 출입 기록을 대조해 주세요.'},
 {name:'최종 투표',label:'당신의 추리를 제출하세요',seconds:60,brief:'범인과 기록 공개 방식을 선택해 주세요. 제출한 투표는 다른 사람에게 보이지 않습니다.'},
 {name:'진실 공개',label:'일곱 번째 이름',seconds:240,brief:'자정이 되었습니다. 여러분의 선택과 사건의 진상을 확인합니다.'}
];
export const locations=[{id:'record',name:'시계탑 기록실',en:'CLOCK TOWER',icon:'clock',desc:'교수가 마지막으로 머문 방',x:54,y:16},{id:'broadcast',name:'방송 조정실',en:'BROADCAST',icon:'radio',desc:'목소리가 흘러나온 곳',x:80,y:40},{id:'press',name:'학보사 편집실',en:'PRESS ROOM',icon:'newspaper',desc:'발행되지 않은 마지막 기사',x:18,y:38},{id:'archive',name:'대학 기록관',en:'ARCHIVE',icon:'archive',desc:'폐기 목록에 남은 흔적',x:23,y:75},{id:'courtyard',name:'중앙광장',en:'CENTRAL SQUARE',icon:'camera',desc:'카메라가 바라본 시계탑',x:54,y:60},{id:'council',name:'학생회실',en:'STUDENT COUNCIL',icon:'flag',desc:'축제 서류 속 숨은 이야기',x:80,y:80}];
export const scenarios=[
 {id:'baekya',title:'백야제',sub:'일곱 번째 이름',genre:'캠퍼스 미스터리',players:6,time:60,difficulty:3,available:true,color:'#9b373f',theme:'campus',description:'개교 100주년 축제 전야. 교수의 마지막 목소리가 울린 뒤, 시계탑에서 시신이 발견된다. 여섯 학생의 비밀과 25년 전 지워진 기록이 교차한다.'},
 {id:'orient',title:'오리엔트 03:17',sub:'마지막 객실',genre:'클래식 추리',players:6,time:70,difficulty:3,color:'#927244',theme:'train',description:'새벽 3시 17분, 설원 위에 멈춘 야간열차. 마지막 객실에는 예약되지 않은 승객이 있었다.'},
 {id:'deep',title:'심해의 증언',sub:'수심 1,400미터',genre:'SF 미스터리',players:6,time:60,difficulty:4,color:'#357c89',theme:'sea',description:'통신이 끊긴 해저 연구기지. 수면 위로 올라갈 수 있는 자리는 여섯 개뿐이다.'},
 {id:'masquerade',title:'가면의 저택',sub:'열두 번째 손님',genre:'고딕 미스터리',players:6,time:80,difficulty:3,color:'#765580',theme:'mansion',description:'가면을 벗지 않는 무도회. 초대장을 보낸 주인은 이미 죽어 있었다.'},
 {id:'orbit',title:'궤도 밖의 밤',sub:'마지막 교신',genre:'우주 미스터리',players:6,time:60,difficulty:4,color:'#646699',theme:'space',description:'귀환을 앞둔 우주 정거장에서 한 명의 생체 신호가 사라졌다.'},
 {id:'theater',title:'붉은 커튼콜',sub:'끝나지 않은 연극',genre:'극장 미스터리',players:6,time:60,difficulty:2,color:'#a34b54',theme:'theater',description:'객석이 비워진 뒤 시작된 두 번째 공연. 마지막 대사는 대본에 없었다.'},
 {id:'snow',title:'설원의 우편함',sub:'보내지 못한 편지',genre:'감성 미스터리',players:6,time:60,difficulty:2,color:'#709294',theme:'snow',description:'눈으로 고립된 산장에 20년 전 소인이 찍힌 편지가 도착한다.'},
 {id:'hotel',title:'호텔 에클립스',sub:'존재하지 않는 층',genre:'호텔 미스터리',players:6,time:70,difficulty:3,color:'#8d794d',theme:'hotel',description:'엘리베이터가 멈춘 13층. 호텔 도면에는 그 층이 없다.'},
 {id:'gallery',title:'사라진 자화상',sub:'새벽의 경매',genre:'예술 미스터리',players:6,time:60,difficulty:3,color:'#6b7c69',theme:'gallery',description:'세상에 단 한 점뿐인 그림이 팔린 날, 그림 속 인물이 사라졌다.'},
 {id:'village',title:'여름의 끝에서',sub:'일곱 번째 종소리',genre:'마을 미스터리',players:6,time:70,difficulty:3,color:'#82715d',theme:'village',description:'매년 같은 날 울리는 마을의 종. 올해는 한 번 더 울렸다.'}
];
