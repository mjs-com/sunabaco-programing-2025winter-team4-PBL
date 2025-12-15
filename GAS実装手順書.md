# Google Apps Script (GAS) 実装手順書

## 概要

月1回自動でSupabaseから日報データを取得し、Google スプレッドシートに出力するためのGoogle Apps Scriptの実装手順です。

---

## ステップ1: スプレッドシートの準備

1. Google スプレッドシートを新規作成
2. スプレッドシート名を「日報月次レポート」などに変更
3. 最初のシート名を「生データ」に変更

---

## ステップ2: Google Apps Scriptの作成

1. スプレッドシートのメニューから「拡張機能」→「Apps Script」を選択
2. エディタが開いたら、以下のコードを貼り付け

```javascript
/**
 * 月次日報データをSupabaseから取得してスプレッドシートに出力
 */

// ==========================================
// 設定値（スクリプトプロパティに保存推奨）
// ==========================================
const CONFIG = {
  SUPABASE_URL: PropertiesService.getScriptProperties().getProperty('SUPABASE_URL') || 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: PropertiesService.getScriptProperties().getProperty('SUPABASE_ANON_KEY') || 'your-anon-key',
};

/**
 * メイン関数：先月の日報データを取得してスプレッドシートに出力
 */
function fetchMonthlyDiaryData() {
  try {
    // 先月の期間を計算
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    
    const startDate = Utilities.formatDate(lastMonth, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const endDate = Utilities.formatDate(lastMonthEnd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    Logger.log(`取得期間: ${startDate} ～ ${endDate}`);
    
    // データを取得
    const data = fetchDiariesFromSupabase(startDate, endDate);
    
    if (!data || data.length === 0) {
      Logger.log('データがありませんでした');
      return;
    }
    
    Logger.log(`${data.length}件のデータを取得しました`);
    
    // スプレッドシートに出力
    writeToSheet(data, startDate, endDate);
    
    Logger.log('スプレッドシートへの出力が完了しました');
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.toString());
    // エラー通知（必要に応じてメール送信など）
    MailApp.sendEmail({
      to: 'your-email@example.com', // 管理者のメールアドレス
      subject: '日報データ取得エラー',
      body: 'エラー内容: ' + error.toString()
    });
  }
}

/**
 * Supabaseから日報データを取得（日報ID順で取得）
 */
function fetchDiariesFromSupabase(startDate, endDate) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/DIARY?target_date=gte.${startDate}&target_date=lte.${endDate}&is_deleted=eq.false&is_hidden=eq.false&parent_id=is.null&select=diary_id,target_date,created_at,title,content,is_urgent,current_status,solved_at,deadline,bounty_points,category:CATEGORY(category_name),staff:STAFF!DIARY_staff_id_fkey(name,job_type:JOB_TYPE(job_name)),solved_by_staff:STAFF!DIARY_solved_by_fkey(name,job_type:JOB_TYPE(job_name)),replies:DIARY!parent_id(diary_id,content,created_at,staff:STAFF!DIARY_staff_id_fkey(name))&order=diary_id.asc`;
  
  const options = {
    'method': 'GET',
    'headers': {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  
  const response = UrlFetchApp.fetch(url, options);
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`APIエラー: ${response.getResponseCode()} - ${response.getContentText()}`);
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * 職種一覧を取得
 */
function fetchJobTypes() {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/JOB_TYPE?is_active=eq.true&select=job_type_id,job_name`;
  
  const options = {
    'method': 'GET',
    'headers': {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

/**
 * スタッフ一覧を取得
 */
function fetchAllStaff() {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/STAFF?is_active=eq.true&select=staff_id,name,job_type_id`;
  
  const options = {
    'method': 'GET',
    'headers': {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

/**
 * 本文からメンションを抽出
 */
function extractMentions(content, jobTypes, allStaff) {
  if (!content) return '';
  
  const mentions = [];
  const foundMentions = new Set();
  
  // 正規表現で@の後に続く文字列を抽出（大文字小文字を区別しない）
  const mentionPattern = /@([^\s@\n]+)/gi;
  const matches = content.matchAll(mentionPattern);
  
  for (const match of matches) {
    const mentionText = match[1];
    const mentionTextLower = mentionText.toLowerCase();
    
    // @All, @all, @ALL などをチェック
    if (mentionTextLower === 'all' && !foundMentions.has('全体')) {
      mentions.push('全体');
      foundMentions.add('全体');
      continue;
    }
    
    // @職種名 をチェック
    if (jobTypes) {
      for (let i = 0; i < jobTypes.length; i++) {
        const jt = jobTypes[i];
        if ((jt.job_name.toLowerCase() === mentionTextLower || jt.job_name === mentionText) && !foundMentions.has(jt.job_name)) {
          mentions.push(jt.job_name);
          foundMentions.add(jt.job_name);
          break;
        }
      }
    }
    
    // @個人名 をチェック
    if (allStaff) {
      for (let i = 0; i < allStaff.length; i++) {
        const staff = allStaff[i];
        if ((staff.name.toLowerCase() === mentionTextLower || staff.name === mentionText) && !foundMentions.has(staff.name)) {
          mentions.push(staff.name);
          foundMentions.add(staff.name);
          break;
        }
      }
    }
  }
  
  return mentions.join('\n') || '';
}

/**
 * 日時を日本時刻の読みやすい形式に変換
 */
function formatJapaneseDateTime(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const jstDate = new Date(date.toLocaleString('en-US', {timeZone: 'Asia/Tokyo'}));
  
  const year = jstDate.getFullYear();
  const month = String(jstDate.getMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getDate()).padStart(2, '0');
  const hours = String(jstDate.getHours()).padStart(2, '0');
  const minutes = String(jstDate.getMinutes()).padStart(2, '0');
  
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * ISO 8601週番号を計算
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * 曜日を取得
 */
function getDayOfWeek(dateString) {
  const date = new Date(dateString);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

/**
 * スプレッドシートにデータを出力（重複チェックなし、全置換）
 */
function writeToSheet(data, startDate, endDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 生データシートを取得または作成
  let sheet = ss.getSheetByName('生データ');
  if (!sheet) {
    sheet = ss.insertSheet('生データ');
  }
  
  // シートをクリア
  sheet.clear();
  
  // データを日報ID順にソート
  data.sort(function(a, b) {
    return a.diary_id - b.diary_id;
  });
  
  // 職種とスタッフ一覧を取得（メンション抽出用）
  const jobTypes = fetchJobTypes();
  const allStaff = fetchAllStaff();
  
  // ヘッダー行
  const headers = [
    '日報ID',
    '対象日付',
    '曜日',
    '週番号',
    '投稿日時',
    'タイトル',
    '本文',
    'カテゴリ',
    '緊急フラグ',
    '入力者名',
    '入力者職種',
    '宛先（メンション）',
    '現在ステータス',
    '解決日時',
    '解決者名',
    '解決者職種',
    '対応時間（時間）',
    '期限',
    '期限超過フラグ',
    '返信数',
    '返信文',
    '特別報酬ポイント',
  ];
  
  // データ行を生成
  const rows = [];
  
  for (let i = 0; i < data.length; i++) {
    const diary = data[i];
    
    // 対象日付から曜日と週番号を計算
    const targetDate = new Date(diary.target_date);
    const dayOfWeek = getDayOfWeek(diary.target_date);
    const weekNumber = getWeekNumber(targetDate);
    
    // 投稿日時をフォーマット
    const createdAt = formatJapaneseDateTime(diary.created_at);
    
    // カテゴリ名
    const categoryName = (diary.category && Array.isArray(diary.category) && diary.category.length > 0) 
      ? diary.category[0].category_name 
      : (diary.category ? diary.category.category_name : '');
    
    // 入力者情報
    const staff = (diary.staff && Array.isArray(diary.staff) && diary.staff.length > 0) 
      ? diary.staff[0] 
      : diary.staff;
    const inputStaffName = staff ? staff.name : '';
    const inputStaffJobType = (staff && staff.job_type) 
      ? (Array.isArray(staff.job_type) ? staff.job_type[0].job_name : staff.job_type.job_name)
      : '';
    
    // メンション抽出
    const mention = extractMentions(diary.content || '', jobTypes, allStaff);
    
    // 解決者情報
    const solvedByStaff = (diary.solved_by_staff && Array.isArray(diary.solved_by_staff) && diary.solved_by_staff.length > 0)
      ? diary.solved_by_staff[0]
      : diary.solved_by_staff;
    const solvedByName = solvedByStaff ? solvedByStaff.name : '';
    const solvedByJobType = (solvedByStaff && solvedByStaff.job_type)
      ? (Array.isArray(solvedByStaff.job_type) ? solvedByStaff.job_type[0].job_name : solvedByStaff.job_type.job_name)
      : '';
    
    // 解決日時
    const solvedAt = diary.solved_at ? formatJapaneseDateTime(diary.solved_at) : '';
    
    // 対応時間を計算（時間単位）
    let responseTimeHours = '';
    if (diary.solved_at && diary.created_at) {
      const created = new Date(diary.created_at);
      const solved = new Date(diary.solved_at);
      const hours = Math.round((solved.getTime() - created.getTime()) / (1000 * 60 * 60) * 10) / 10;
      responseTimeHours = hours.toString();
    }
    
    // 期限超過フラグ
    let isDeadlineOverdue = 'いいえ';
    if (diary.deadline) {
      if (diary.solved_at) {
        isDeadlineOverdue = new Date(diary.solved_at) > new Date(diary.deadline) ? 'はい' : 'いいえ';
      } else {
        isDeadlineOverdue = new Date() > new Date(diary.deadline) ? 'はい' : 'いいえ';
      }
    }
    
    // 返信数と返信文
    const replies = diary.replies || [];
    const replyCount = replies.length;
    
    // 返信文を日付順にソートして結合
    const sortedReplies = replies.slice().sort(function(a, b) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    const replyContent = sortedReplies
      .map(function(reply) {
        const content = reply.content || '';
        if (!content.trim()) return '';
        
        // 返信者名を取得
        const replyStaff = (reply.staff && Array.isArray(reply.staff) && reply.staff.length > 0)
          ? reply.staff[0]
          : reply.staff;
        const replyStaffName = replyStaff ? replyStaff.name : '不明';
        
        // [返信者名]\n返信内容 の形式で返す
        return '[' + replyStaffName + ']\n' + content;
      })
      .filter(function(formattedReply) {
        return formattedReply.trim() !== '';
      })
      .join('\n---\n');
    
    // 行データを作成
    rows.push([
      diary.diary_id,
      diary.target_date,
      dayOfWeek,
      weekNumber,
      createdAt,
      diary.title || '',
      diary.content || '',
      categoryName,
      diary.is_urgent ? 'はい' : 'いいえ',
      inputStaffName,
      inputStaffJobType,
      mention,
      diary.current_status || 'UNREAD',
      solvedAt,
      solvedByName,
      solvedByJobType,
      responseTimeHours,
      diary.deadline || '',
      isDeadlineOverdue,
      replyCount,
      replyContent,
      diary.bounty_points || '',
    ]);
  }
  
  // ヘッダーとデータを書き込み
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  // ヘッダー行を固定
  sheet.setFrozenRows(1);
  
  // 列幅を自動調整（オプション）
  sheet.autoResizeColumns(1, headers.length);
  
  Logger.log(`${rows.length}行のデータを出力しました`);
}

/**
 * スプレッドシートにデータを出力（重複チェックあり、上書き）
 * 日報IDが重複する場合は既存の行を上書き、新規の場合は追加
 */
function writeToSheetWithMerge(data, startDate, endDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 生データシートを取得または作成
  let sheet = ss.getSheetByName('生データ');
  if (!sheet) {
    sheet = ss.insertSheet('生データ');
  }
  
  // データを日報ID順にソート
  data.sort(function(a, b) {
    return a.diary_id - b.diary_id;
  });
  
  // 職種とスタッフ一覧を取得（メンション抽出用）
  const jobTypes = fetchJobTypes();
  const allStaff = fetchAllStaff();
  
  // ヘッダー行
  const headers = [
    '日報ID',
    '対象日付',
    '曜日',
    '週番号',
    '投稿日時',
    'タイトル',
    '本文',
    'カテゴリ',
    '緊急フラグ',
    '入力者名',
    '入力者職種',
    '宛先（メンション）',
    '現在ステータス',
    '解決日時',
    '解決者名',
    '解決者職種',
    '対応時間（時間）',
    '期限',
    '期限超過フラグ',
    '返信数',
    '返信文',
    '特別報酬ポイント',
  ];
  
  // 既存データを取得（ヘッダー行を除く）
  const lastRow = sheet.getLastRow();
  let existingData = [];
  let existingDiaryIds = new Map(); // 日報ID -> 行番号のマッピング
  
  if (lastRow > 1) {
    const existingRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
    existingData = existingRange.getValues();
    
    // 既存の日報IDと行番号のマッピングを作成（ヘッダー行を除くため+2）
    for (let i = 0; i < existingData.length; i++) {
      const diaryId = existingData[i][0];
      if (diaryId) {
        existingDiaryIds.set(diaryId, i + 2); // 行番号は1ベース、ヘッダー行があるため+2
      }
    }
  } else {
    // ヘッダー行がない場合は作成
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  
  // 新規追加する行と更新する行を分ける
  const rowsToAdd = [];
  const rowsToUpdate = [];
  
  for (let i = 0; i < data.length; i++) {
    const diary = data[i];
    
    // 対象日付から曜日と週番号を計算
    const targetDate = new Date(diary.target_date);
    const dayOfWeek = getDayOfWeek(diary.target_date);
    const weekNumber = getWeekNumber(targetDate);
    
    // 投稿日時をフォーマット
    const createdAt = formatJapaneseDateTime(diary.created_at);
    
    // カテゴリ名
    const categoryName = (diary.category && Array.isArray(diary.category) && diary.category.length > 0) 
      ? diary.category[0].category_name 
      : (diary.category ? diary.category.category_name : '');
    
    // 入力者情報
    const staff = (diary.staff && Array.isArray(diary.staff) && diary.staff.length > 0) 
      ? diary.staff[0] 
      : diary.staff;
    const inputStaffName = staff ? staff.name : '';
    const inputStaffJobType = (staff && staff.job_type) 
      ? (Array.isArray(staff.job_type) ? staff.job_type[0].job_name : staff.job_type.job_name)
      : '';
    
    // メンション抽出
    const mention = extractMentions(diary.content || '', jobTypes, allStaff);
    
    // 解決者情報
    const solvedByStaff = (diary.solved_by_staff && Array.isArray(diary.solved_by_staff) && diary.solved_by_staff.length > 0)
      ? diary.solved_by_staff[0]
      : diary.solved_by_staff;
    const solvedByName = solvedByStaff ? solvedByStaff.name : '';
    const solvedByJobType = (solvedByStaff && solvedByStaff.job_type)
      ? (Array.isArray(solvedByStaff.job_type) ? solvedByStaff.job_type[0].job_name : solvedByStaff.job_type.job_name)
      : '';
    
    // 解決日時
    const solvedAt = diary.solved_at ? formatJapaneseDateTime(diary.solved_at) : '';
    
    // 対応時間を計算（時間単位）
    let responseTimeHours = '';
    if (diary.solved_at && diary.created_at) {
      const created = new Date(diary.created_at);
      const solved = new Date(diary.solved_at);
      const hours = Math.round((solved.getTime() - created.getTime()) / (1000 * 60 * 60) * 10) / 10;
      responseTimeHours = hours.toString();
    }
    
    // 期限超過フラグ
    let isDeadlineOverdue = 'いいえ';
    if (diary.deadline) {
      if (diary.solved_at) {
        isDeadlineOverdue = new Date(diary.solved_at) > new Date(diary.deadline) ? 'はい' : 'いいえ';
      } else {
        isDeadlineOverdue = new Date() > new Date(diary.deadline) ? 'はい' : 'いいえ';
      }
    }
    
    // 返信数と返信文
    const replies = diary.replies || [];
    const replyCount = replies.length;
    
    // 返信文を日付順にソートして結合
    const sortedReplies = replies.slice().sort(function(a, b) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    const replyContent = sortedReplies
      .map(function(reply) {
        const content = reply.content || '';
        if (!content.trim()) return '';
        
        // 返信者名を取得
        const replyStaff = (reply.staff && Array.isArray(reply.staff) && reply.staff.length > 0)
          ? reply.staff[0]
          : reply.staff;
        const replyStaffName = replyStaff ? replyStaff.name : '不明';
        
        // [返信者名]\n返信内容 の形式で返す
        return '[' + replyStaffName + ']\n' + content;
      })
      .filter(function(formattedReply) {
        return formattedReply.trim() !== '';
      })
      .join('\n---\n');
    
    // 行データを作成
    const rowData = [
      diary.diary_id,
      diary.target_date,
      dayOfWeek,
      weekNumber,
      createdAt,
      diary.title || '',
      diary.content || '',
      categoryName,
      diary.is_urgent ? 'はい' : 'いいえ',
      inputStaffName,
      inputStaffJobType,
      mention,
      diary.current_status || 'UNREAD',
      solvedAt,
      solvedByName,
      solvedByJobType,
      responseTimeHours,
      diary.deadline || '',
      isDeadlineOverdue,
      replyCount,
      replyContent,
      diary.bounty_points || '',
    ];
    
    // 既存の日報IDかチェック
    if (existingDiaryIds.has(diary.diary_id)) {
      // 既存の行を更新
      const rowNumber = existingDiaryIds.get(diary.diary_id);
      rowsToUpdate.push({ row: rowNumber, data: rowData });
    } else {
      // 新規追加
      rowsToAdd.push(rowData);
    }
  }
  
  // 既存行を更新
  for (let i = 0; i < rowsToUpdate.length; i++) {
    const updateInfo = rowsToUpdate[i];
    sheet.getRange(updateInfo.row, 1, 1, headers.length).setValues([updateInfo.data]);
  }
  
  // 新規行を追加
  if (rowsToAdd.length > 0) {
    const nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, rowsToAdd.length, headers.length).setValues(rowsToAdd);
  }
  
  // 日報ID順にソート（A列でソート）
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
  dataRange.sort({column: 1, ascending: true});
  
  // 列幅を自動調整（オプション）
  sheet.autoResizeColumns(1, headers.length);
  
  Logger.log(`${rowsToUpdate.length}行を更新、${rowsToAdd.length}行を追加しました`);
}

/**
 * 手動実行用：指定期間のデータを取得
 * @param {string} startDate - 開始日（YYYY-MM-DD形式）
 * @param {string} endDate - 終了日（YYYY-MM-DD形式）
 */
function fetchDiaryDataByDateRange(startDate, endDate) {
  try {
    const data = fetchDiariesFromSupabase(startDate, endDate);
    
    if (!data || data.length === 0) {
      Logger.log('データがありませんでした');
      return;
    }
    
    Logger.log(`${data.length}件のデータを取得しました`);
    writeToSheet(data, startDate, endDate);
    Logger.log('スプレッドシートへの出力が完了しました');
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.toString());
  }
}

/**
 * 手動インポート用：指定期間のデータを取得してマージ（重複時は上書き）
 * @param {string} startDate - 開始日（YYYY-MM-DD形式）
 * @param {string} endDate - 終了日（YYYY-MM-DD形式）
 */
function importDiaryDataByDateRange(startDate, endDate) {
  try {
    const data = fetchDiariesFromSupabase(startDate, endDate);
    
    if (!data || data.length === 0) {
      SpreadsheetApp.getUi().alert('データがありませんでした');
      return;
    }
    
    Logger.log(`${data.length}件のデータを取得しました`);
    writeToSheetWithMerge(data, startDate, endDate);
    SpreadsheetApp.getUi().alert(`${data.length}件のデータをインポートしました`);
    Logger.log('スプレッドシートへのインポートが完了しました');
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.toString());
    SpreadsheetApp.getUi().alert('エラーが発生しました: ' + error.toString());
  }
}

/**
 * テスト用：指定期間のデータを取得（日付を直接指定）
 * この関数を実行すると、2025年11月のデータを取得します
 * 日付を変更したい場合は、この関数内の日付を編集してください
 */
function testFetchDiaryData() {
  // テスト用の期間を指定（必要に応じて変更してください）
  const startDate = '2025-11-01';
  const endDate = '2025-11-30';
  
  fetchDiaryDataByDateRange(startDate, endDate);
}

/**
 * スプレッドシートを開いたときにカスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('データインポート')
    .addItem('手動インポート', 'showImportDialog')
    .addToUi();
}

/**
 * 手動インポート用のダイアログを表示
 */
function showImportDialog() {
  const html = HtmlService.createHtmlOutputFromFile('ImportDialog')
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, '期間を指定してデータをインポート');
}

/**
 * ダイアログから呼び出される：期間を指定してデータをインポート
 * @param {string} startDate - 開始日（YYYY-MM-DD形式）
 * @param {string} endDate - 終了日（YYYY-MM-DD形式）
 */
function importDataFromDialog(startDate, endDate) {
  importDiaryDataByDateRange(startDate, endDate);
}
```

3. ファイル名を「月次日報エクスポート」などに変更して保存

4. **HTMLダイアログファイルの作成**：
   - Apps Scriptエディタで「+」ボタンをクリックして「HTML」を選択
   - ファイル名を「ImportDialog」に変更
   - 以下のHTMLコードを貼り付け：

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type="date"] {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .button-group {
      text-align: right;
      margin-top: 20px;
    }
    button {
      padding: 10px 20px;
      margin-left: 10px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-primary {
      background-color: #1a73e8;
      color: white;
    }
    .btn-primary:hover {
      background-color: #1557b0;
    }
    .btn-secondary {
      background-color: #f1f3f4;
      color: #202124;
    }
    .btn-secondary:hover {
      background-color: #e8eaed;
    }
  </style>
</head>
<body>
  <h3>期間を指定してデータをインポート</h3>
  <p>指定した期間の日報データを取得し、既存データとマージします。<br>
  日報IDが重複する場合は既存の行を上書きします。</p>
  
  <div class="form-group">
    <label for="startDate">開始日:</label>
    <input type="date" id="startDate" required>
  </div>
  
  <div class="form-group">
    <label for="endDate">終了日:</label>
    <input type="date" id="endDate" required>
  </div>
  
  <div class="button-group">
    <button class="btn-secondary" onclick="google.script.host.close()">キャンセル</button>
    <button class="btn-primary" onclick="importData()">インポート</button>
  </div>
  
  <script>
    // デフォルトで今月の1日から今日までを設定
    window.onload = function() {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      
      document.getElementById('startDate').value = firstDay.toISOString().split('T')[0];
      document.getElementById('endDate').value = today.toISOString().split('T')[0];
    };
    
    function importData() {
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      
      if (!startDate || !endDate) {
        alert('開始日と終了日を入力してください');
        return;
      }
      
      if (startDate > endDate) {
        alert('開始日は終了日より前の日付を指定してください');
        return;
      }
      
      // ボタンを無効化
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = 'インポート中...';
      
      google.script.run
        .withSuccessHandler(function() {
          google.script.host.close();
        })
        .withFailureHandler(function(error) {
          alert('エラーが発生しました: ' + error.message);
          btn.disabled = false;
          btn.textContent = 'インポート';
        })
        .importDataFromDialog(startDate, endDate);
    }
  </script>
</body>
</html>
```

---

## ステップ3: スクリプトプロパティの設定（推奨）

セキュリティのため、SupabaseのURLとAPIキーをスクリプトプロパティに保存します。

1. Apps Scriptエディタで「プロジェクトの設定」（歯車アイコン）をクリック
2. 「スクリプト プロパティ」セクションで「スクリプト プロパティを追加」をクリック
3. 以下の2つのプロパティを追加：

| プロパティ名 | 値 |
|------------|-----|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | `your-anon-key` |

**注意**: 実際のSupabase URLとAnon Keyに置き換えてください。

---

## ステップ4: 月次トリガーの設定

1. Apps Scriptエディタで「トリガー」（時計アイコン）をクリック
2. 「トリガーを追加」をクリック
3. 以下の設定を行う：
   - **実行する関数**: `fetchMonthlyDiaryData`
   - **イベントのソース**: **時間主導型**
   - **時間ベースのトリガー**: **月タイマー**
   - **日時**: **月の1日**（例：午前9時）
   - **エラー通知設定**: **すぐに通知を受け取る**（推奨）

4. 「保存」をクリック

これで、毎月1日の指定時刻に自動実行されます。

---

## ステップ5: 動作確認

### 5-1. 手動実行でテスト

1. Apps Scriptエディタで `fetchMonthlyDiaryData` 関数を選択
2. 「実行」ボタンをクリック
3. 初回実行時は認証が必要です：
   - 「権限を確認」をクリック
   - Googleアカウントを選択
   - 「詳細」→「（プロジェクト名）に移動」をクリック
   - 「許可」をクリック
4. 実行ログを確認（「実行ログ」タブ）
5. スプレッドシートの「生データ」シートにデータが出力されているか確認

### 5-2. 指定期間でのテスト

**方法1: テスト用関数を使用（推奨）**

1. Apps Scriptエディタで、コード内の `testFetchDiaryData` 関数を確認
2. 必要に応じて、関数内の日付を変更：
   ```javascript
   const startDate = '2025-11-01';  // 開始日を変更
   const endDate = '2025-11-30';    // 終了日を変更
   ```
3. 関数名のドロップダウンから `testFetchDiaryData` を選択
4. 「実行」ボタン（▶）をクリック
5. 実行ログを確認（「実行ログ」タブ）
6. スプレッドシートの「生データ」シートにデータが出力されているか確認

**方法2: コードを直接編集してテスト**

1. `fetchMonthlyDiaryData` 関数を一時的に編集：
   ```javascript
   function fetchMonthlyDiaryData() {
     // 先月の期間を計算（この部分をコメントアウト）
     // const today = new Date();
     // const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
     // const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
     
     // テスト用の期間を直接指定
     const startDate = '2025-11-01';
     const endDate = '2025-11-30';
     
     // 以下はそのまま
     Logger.log(`取得期間: ${startDate} ～ ${endDate}`);
     // ...（以下省略）
   }
   ```
2. `fetchMonthlyDiaryData` 関数を実行
3. テスト完了後、編集した部分を元に戻す

---

## ステップ6: スプレッドシートテンプレートの作成（オプション）

分析用のシートを事前に作成しておくこともできます：

### 6-1. カテゴリ分析シート

1. 新しいシート「カテゴリ分析」を作成
2. ピボットテーブルを作成：
   - データソース: 「生データ」シート
   - 行: カテゴリ
   - 値: 日報ID（カウント）

### 6-2. 担当者分析シート

1. 新しいシート「担当者分析」を作成
2. ピボットテーブルを作成：
   - データソース: 「生データ」シート
   - 行: 入力者名
   - 値: 日報ID（カウント）、対応時間（平均）

### 6-3. ダッシュボードシート

1. 新しいシート「ダッシュボード」を作成
2. 主要KPIを表示：
   - 総日報数: `=COUNTA(生データ!A:A)-1`
   - 未解決数: `=COUNTIF(生データ!M:M,"UNREAD")+COUNTIF(生データ!M:M,"CONFIRMED")+COUNTIF(生データ!M:M,"WORKING")`
   - 解決率: `=COUNTIF(生データ!M:M,"SOLVED")/(COUNTA(生データ!A:A)-1)`

---

## トラブルシューティング

### エラー: "APIエラー: 401"

- **原因**: SupabaseのAPIキーが正しくない、または権限がない
- **対処**: スクリプトプロパティの `SUPABASE_ANON_KEY` を確認

### エラー: "データが取得できません"

- **原因**: SupabaseのURLが正しくない、またはネットワークエラー
- **対処**: スクリプトプロパティの `SUPABASE_URL` を確認、SupabaseのダッシュボードでAPIが有効か確認

### エラー: "スプレッドシートへの書き込みエラー"

- **原因**: スプレッドシートの権限がない
- **対処**: スプレッドシートの共有設定を確認し、実行するGoogleアカウントに編集権限があることを確認

---

## セキュリティ注意事項

1. **スクリプトプロパティの使用**: APIキーをコードに直接書かず、スクリプトプロパティに保存してください
2. **スプレッドシートの共有設定**: 適切なユーザーのみに共有してください
3. **ログの確認**: 定期的に実行ログを確認し、エラーがないかチェックしてください

---

## カスタマイズ

### 実行頻度の変更

トリガー設定で「週タイマー」「日タイマー」などに変更できます。

### エラー通知の設定

`fetchMonthlyDiaryData` 関数内の `MailApp.sendEmail` のメールアドレスを変更してください。

### 出力先シートの変更

`writeToSheet` 関数内の `ss.getSheetByName('生データ')` のシート名を変更してください。

---

---

## ステップ7: カスタムメニューと手動インポート機能

### 7-1. 機能概要

スプレッドシートのメニューバーに「データインポート」メニューを追加し、手動で期間を指定してデータをインポートできる機能です。

**主な機能：**
- カスタムメニュー「データインポート」→「手動インポート」から実行
- ポップアップで開始日・終了日を指定
- 日報IDが重複する場合は既存の行を上書き
- 新規データは追加される
- データは日報ID順でソートされる

### 7-2. 使用方法

1. スプレッドシートを開く
2. メニューバーに「データインポート」が表示されることを確認
3. 「データインポート」→「手動インポート」をクリック
4. ポップアップで開始日と終了日を指定
5. 「インポート」ボタンをクリック
6. データがインポートされ、重複する日報IDは上書きされる

### 7-3. データの出力順序

データは**日報IDの昇順**で出力されます。既存データと新規データをマージした後も、日報ID順でソートされます。

---

*作成日: 2025年12月15日*
*更新日: 2025年12月15日（カスタムメニュー・手動インポート機能追加）*
