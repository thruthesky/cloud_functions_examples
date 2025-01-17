import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import firebase from 'firebase/compat/app';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';
import { readFileSync } from "node:fs";
import { before } from "mocha";


/****** SETUP ********/
const PROJECT_ID = 'withcenter-test-5'; // 실제 프로젝트 ID로 지정해야 한다.
const host = '127.0.0.1'; // localhost 로 하면 안된다.
const port = 8080; // 터미날에 표시되는 포트로 적절히 지정해야 한다.
let testEnv: RulesTestEnvironment;

// 로그인 하지 않은, unauthenticated context 를 글로벌에 저장해서, 타이핑을 줄이고 간소화 한다.
let unauthedDb: firebase.firestore.Firestore;

// 각 사용자별 로그인 context 를 저장해 놓고 편하게 사용한다.
let appleDb: firebase.firestore.Firestore;
let bananaDb: firebase.firestore.Firestore;
let cherryDb: firebase.firestore.Firestore;
let durianDb: firebase.firestore.Firestore;




describe('전반적인 파이어스토어 규칙 테스트', async () => {

  // 모든 테스트를 시작하기 전에 실행되는 콜백 함수.
  // 여기에 initializeTestEnvironment() 를 호출해서, Firestore 접속을 초기화 하면 된다.
  // watch 코드가 수정될 경우, 전체 테스트를 다시 실행하면, 이 함수도 다시 호출 된다.
  before(async () => {
    setLogLevel("error"); // 로그 레벨을 설정한다.
    /// 모든 테스트를 실행하기 전에, 파이어베이스 접속 초기화.
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        // Firestore Security Rules 파일을 읽어서, 테스트 환경에 적용한다.
        // 즉, Security Rules 파일을 수정하고, 테스트를 다시 실행하면, 수정된 Rules 이 적용되므로,
        // mocha watch 를 하는 경우, 소스 코드를 수정 필요 없이 저장만 한번 해 주면 된다.
        rules: readFileSync('firestore.rules', 'utf8')
      },
    });

  });

  // 각 테스트를 하기 전에, 로컬 Firestore 의 데이터를 모두 지운다.
  beforeEach(async () => {
    await testEnv.clearFirestore();

    // 셋업: Security Rules 를 적용하지 않고, 테스트 데이터를 미리 좀 저장해 놓는다.
    // withSecurityRulesDisabled 는 한번에 하나의 쿼리만 실행해야 한다. 그렇지 않으면,
    // Firestore has already been started and its settings can no longer be change 에러가 발생한다.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/apple'), { name: 'apple', no: 1 });
    });

    // 각 사용자 정보를 미리 저장해 둔다.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/apple/user_meta/private'), { email: 'apple@email.com', phoneNumber: '000-1111-1111' });
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/banana'), { name: 'banana', no: 2 });
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/banana/user_meta/private'), { email: 'banana@email.com', phoneNumber: '000-2222-2222' });
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/cherry'), { name: 'cherry', no: 3 });
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/cherry/user_meta/private'), { email: 'cherry@email.com', phoneNumber: '000-3333-3333' });
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/durian'), { name: 'cherry', no: 4 });
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/durian/user_meta/private'), { email: 'durian@email.com', phoneNumber: '000-4444-4444' });
    });


    // 주의: 캐시 문제를 피하기 위해서, 각 테스트마다 새로운 unauthenticated context 로 DB 를 생성해야 한다.
    unauthedDb = testEnv.unauthenticatedContext().firestore();

    // 사용자별 DB 액세스 context 저장. 캐시 문제로 각 테스트 전에 새로 생성해야 한다.
    appleDb = testEnv.authenticatedContext('apple').firestore();
    bananaDb = testEnv.authenticatedContext('banana').firestore();
    cherryDb = testEnv.authenticatedContext('cherry').firestore();
    durianDb = testEnv.authenticatedContext('durian').firestore();

  });

  it('공개 프로필 읽기 테스트 - 성공 - 로그인 하지 않고 참조', async () => {
    await assertSucceeds(getDoc(doc(unauthedDb, '/users/apple')));
  });

  it('비공개 프로필 읽기 테스트 - 성공', async () => {
    await assertSucceeds(getDoc(doc(appleDb, '/users/apple/user_meta/private')));
  });

  it('비공개 프로필 읽기 테스트 - 실패 - 다른 사용자 비공개 정보 읽기', async () => {
    await assertFails(getDoc(doc(appleDb, '/users/banana/user_meta/private')));
  });

  it("공개 정보 생성 - alice", async () => {
    const context = testEnv.authenticatedContext("alice", { email: "alice@email.com", });
    await assertSucceeds(setDoc(doc(context.firestore(), '/users/alice'), { name: 'Alice' }));
  });

  it("나의 공개 정보 생성 by apple - 성공 ", async () => {
    await assertSucceeds(setDoc(doc(appleDb, '/users/apple'), {}));
  });



  it("나의 공개 정보 생성 by banana - 성공 ", async () => {
    await assertSucceeds(updateDoc(doc(cherryDb, '/users/cherry'), { 'name': 'Cherry Q' }));
  });

  it("나의 공개 정보 수정 by cherrry - 성공 ", async () => {
    await assertSucceeds(updateDoc(doc(cherryDb, '/users/cherry'), { 'name': 'Cherry Q' }));
  });

  it("타인의 공개 정보 수정 - 실패", async () => {
    await assertFails(setDoc(doc(appleDb, '/users/banana'), { name: 'Banana Q' }));
    await assertFails(updateDoc(doc(unauthedDb, '/users/banana'), { name: 'Banana Q' }));
  });


  it("나의 공개 정보 삭제 불가", async () => {
    await assertFails(deleteDoc(doc(appleDb, '/users/apple')));
  });
  it("타인의 공개 정보 삭제 불가", async () => {
    await assertFails(deleteDoc(doc(appleDb, '/users/banana')));
  });

  it("나의 비공개 정보 문서 - 생성 - 성공", async () => {
    await assertSucceeds(setDoc(doc(appleDb, '/users/apple/user_meta/private'), { email: 'email', phoneNumber: 'phone number' }));
  });
  it("나의 비공개 정보 문서 - 수정 - 성공", async () => {
    await assertSucceeds(updateDoc(doc(appleDb, '/users/apple/user_meta/private'), { email: 'email', phoneNumber: 'phone number' }));
  });
  it("나의 비공개 정보 수정 - 성공", async () => {
    await assertSucceeds(setDoc(doc(appleDb, '/users/apple/user_meta/private'), { email: 'email', phoneNumber: 'phone number' }));
    await assertSucceeds(updateDoc(doc(appleDb, '/users/apple/user_meta/private'), { email: 'email', phoneNumber: 'phone number' }));
  });
  it("타인의 비공개 정보 수정 - 실패", async () => {
    await assertFails(setDoc(doc(appleDb, '/users/banana/user_meta/private'), { email: 'email', phoneNumber: 'phone number' }));
    await assertFails(updateDoc(doc(appleDb, '/users/banana/user_meta/private'), { email: 'email', phoneNumber: 'phone number' }));
  });

  it("나의 비공개 정보 삭제 - 실패", async () => {
    await assertFails(deleteDoc(doc(appleDb, '/users/apple/user_meta/private')));
  });

  it("타인의 비공개 정보 삭제 - 실패", async () => {
    await assertFails(deleteDoc(doc(appleDb, '/users/banana/user_meta/private')));
  });

  it("나의 설정 읽기 - 성공", async () => {
    await assertSucceeds(getDoc(doc(appleDb, '/users/apple/user_meta/settings')));
  });
  it("타인의 설정 읽기 - 성공", async () => {
    await assertSucceeds(getDoc(doc(appleDb, '/users/banana/user_meta/settings')));
  });
  it("나의 설정 생성 & 수정", async () => {
    await assertSucceeds(setDoc(doc(appleDb, '/users/apple/user_meta/settings'), { theme: 'dark' }));
    await assertSucceeds(updateDoc(doc(appleDb, '/users/apple/user_meta/settings'), { theme: 'light' }));
  });
  it("타인의 설정 생성 & 수정 - 실패", async () => {
    await assertFails(setDoc(doc(appleDb, '/users/banana/user_meta/settings'), { theme: 'dark' }));
    await assertFails(updateDoc(doc(appleDb, '/users/banana/user_meta/settings'), { theme: 'light' }));
  });

  it("나의 설정 삭제 - 실패", async () => {
    await assertFails(deleteDoc(doc(appleDb, '/users/apple/user_meta/settings')));
  });
  it("타인의 설정 삭제 - 실패", async () => {
    await assertFails(deleteDoc(doc(appleDb, '/users/banana/user_meta/settings')));
  });


  // 관리자 권한 테스트 --------------
  //
  // 관리자가 지정되지 않았으면, 아무나 자기 자신읠 root 관리자로 지정 할 수 있다.
  // 관리자 설정은 /settings/admins 에 저장된다.
  it("나 자신을 root 관리자로 지정하기", async () => {
    await assertSucceeds(setDoc(doc(appleDb, '/settings/admins'), { 'apple': ['root', 'customer-chat-support'] }));

    // 로컬 Firestore 의 데이터를 가져와서 확인하는 방법
    const snapshot = await getDoc(doc(unauthedDb, '/settings/admins'));
    const data = snapshot.data();
    console.log(data);
  });

  it("다른 사용자를 관리자로 지정하기", async () => {
    await assertFails(setDoc(doc(appleDb, '/settings/admins'), { 'banana': ['root'] }));
  });

  it("이미 관리자가 지정되어져 있는데, 나를 root 관리자로 지정하는 경우 - 실패", async () => {
    await assertSucceeds(setDoc(doc(appleDb, '/settings/admins'), { 'apple': ['root', 'customer-chat-support'] }));
    await assertFails(setDoc(doc(bananaDb, '/settings/admins'), { 'banana': ['root'] }));
  });


});
