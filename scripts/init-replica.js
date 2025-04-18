// MongoDB 복제본 세트(ReplicaSet) 초기화 스크립트
print('MongoDB ReplicaSet 초기화를 시작합니다...');

// 복제본 세트 설정
const config = {
  _id: 'rs0',
  members: [{ _id: 0, host: 'localhost:27017', priority: 1 }],
};

// 복제본 세트 초기화
rs.initiate(config);

// 상태 확인 및 기다리기
print('복제본 세트 설정을 확인하는 중...');
let attempts = 30;
while (attempts > 0) {
  const status = rs.status();
  if (status.ok) {
    if (status.members && status.members[0].state === 1) {
      print('복제본 세트가 성공적으로 초기화되었습니다!');
      printjson(status);
      break;
    }
  }

  print('복제본 세트가 아직 준비되지 않았습니다. 잠시 후 다시 확인합니다...');
  sleep(1000);
  attempts--;
}

if (attempts === 0) {
  print('경고: 복제본 세트 초기화 후 PRIMARY 상태를 확인할 수 없습니다.');
}

print('MongoDB 초기화 스크립트 완료');
