/**
 * 마중마을힐링캠프 — 예약 현황 스프레드시트 연동용 Apps Script
 *
 * 시트 첫 행(헤더) 구성:
 * 날짜 | 예약가능사이트 개수 | 예약된 사이트 개수 | 입실 수 | 퇴실 수 | 이용중 수 | 만실률
 *
 * - 시트 이름이 '시트1'이든 'Sheet1'이든 상관없이 "첫 번째 시트"를 사용합니다.
 * - 화면(웹페이지) 쪽에서는 fetch 요청 시 Content-Type을 'text/plain'으로 보내야
 *   브라우저가 사전 확인 요청(OPTIONS, CORS preflight)을 보내지 않아 오류가 나지 않습니다.
 * - 모든 응답은 JSON 문자열로 돌려줍니다.
 * - 만실률은 (예약된 사이트 ÷ 예약가능 사이트)로 계산합니다. (입실/퇴실/이용중은 참고용 기록)
 * - 예약가능 사이트 개수는 화면에는 표시하지 않고, 만실률 계산에만 서버 내부적으로 사용합니다.
 */

/** 이 스프레드시트의 "첫 번째 시트"를 이름과 상관없이 가져옵니다. */
function getSheet_() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheets()[0];
  }
  
  /** 시트에 헤더(첫 행)가 없으면 자동으로 만들어 둡니다. */
  function ensureHeader_(sheet) {
    var firstCell = sheet.getRange(1, 1).getValue();
    if (firstCell !== '날짜') {
      sheet.getRange(1, 1, 1, 7).setValues([
        ['날짜', '예약가능사이트 개수', '예약된 사이트 개수', '입실 수', '퇴실 수', '이용중 수', '만실률']
      ]);
    }
  }
  
  /** 문자열/Date 값을 'YYYY-MM-DD' 형식의 문자열로 통일합니다. */
  function toDateKey_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]') {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    return String(value).trim();
  }
  
  /** 결과 객체를 JSON 문자열로 감싸서 text/plain 형식으로 응답합니다 (CORS 회피용). */
  function jsonResponse_(obj) {
    return ContentService
      .createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  /** 같은 날짜의 기존 행이 있으면 그 행 번호를, 없으면 -1을 돌려줍니다. */
  function findRowByDate_(sheet, dateKey) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;
    var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < dates.length; i++) {
      if (toDateKey_(dates[i][0]) === dateKey) {
        return i + 2; // 실제 시트 행 번호 (헤더가 1행이므로 +2)
      }
    }
    return -1;
  }
  
  /** 시트의 모든 기록을 배열로 읽어옵니다. (날짜, 예약가능, 예약됨, 입실, 퇴실, 이용중, 만실률) */
  function readAllRecords_(sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    var records = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (row[0] === '' || row[0] === null) continue; // 빈 행 건너뛰기
      records.push({
        date: toDateKey_(row[0]),
        available: Number(row[1]) || 0,
        reserved: Number(row[2]) || 0,
        checkins: Number(row[3]) || 0,
        checkouts: Number(row[4]) || 0,
        inUse: Number(row[5]) || 0,
        percent: Number(row[6]) || 0
      });
    }
    // 최신 날짜가 먼저 오도록 정렬
    records.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return records;
  }
  
  /**
   * 웹앱 GET 요청 처리: 저장된 모든 기록을 JSON으로 돌려줍니다.
   * 화면(홈, 그래프) 쪽에서 데이터를 불러올 때 사용합니다.
   */
  function doGet(e) {
    var sheet = getSheet_();
    ensureHeader_(sheet);
    var records = readAllRecords_(sheet);
    return jsonResponse_({ ok: true, records: records });
  }
  
  /**
   * 웹앱 POST 요청 처리: 새 기록을 저장(또는 같은 날짜면 덮어쓰기)합니다.
   * 화면(기록하기)에서 날짜/예약됨/입실/퇴실/이용중 값을 text/plain body(JSON 문자열)로 보내면
   * (예약가능 사이트 개수는 화면에 안 보이지만 함께 전송되는 값이에요)
   * 만실률을 서버에서 계산해 시트에 반영하고, 저장된 기록을 JSON으로 돌려줍니다.
   */
  function doPost(e) {
    var sheet = getSheet_();
    ensureHeader_(sheet);
  
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse_({ ok: false, error: '요청 형식이 올바르지 않습니다.' });
    }
  
    var dateKey = toDateKey_(body.date);
    var available = Number(body.available);
    var reserved = Number(body.reserved);
    var checkins = Number(body.checkins) || 0;
    var inUse = Number(body.inUse) || 0;
    var checkouts = Number(body.checkouts) || 0;
  
    if (!dateKey || isNaN(available) || isNaN(reserved) || available <= 0) {
      return jsonResponse_({ ok: false, error: '날짜/예약가능/예약됨 값을 확인해 주세요.' });
    }
  
    var percent = Math.round((reserved / available) * 100);
    var rowData = [dateKey, available, reserved, checkins, checkouts, inUse, percent];
  
    var existingRow = findRowByDate_(sheet, dateKey);
    if (existingRow > 0) {
      // 같은 날짜 기록이 이미 있으면 최신 값으로 덮어쓰기
      sheet.getRange(existingRow, 1, 1, 7).setValues([rowData]);
    } else {
      // 새 날짜면 맨 아래에 한 행 추가
      sheet.appendRow(rowData);
    }
  
    return jsonResponse_({
      ok: true,
      saved: {
        date: dateKey, available: available, reserved: reserved,
        checkins: checkins, inUse: inUse, checkouts: checkouts, percent: percent
      }
    });
  }