#!/usr/bin/env python3
"""
섹션 8_9 (페이지 274-382) 이미지에서 텍스트 추출 스크립트.
각 짝수 페이지 이미지를 읽어 habitat/morphology/ecology/other 필드를 추출한다.

사용법:
  ANTHROPIC_API_KEY=sk-... python3 extract_section8_9.py
  또는
  python3 extract_section8_9.py --api-key sk-...
"""

import json
import base64
import sys
import os
import time
import argparse

sys.path.insert(0, '/Users/hwanghyeonseong/Library/Python/3.9/lib/python/site-packages')
import anthropic

IMAGES_DIR = '/Users/hwanghyeonseong/nibr_insects'
SECTION_JSON = '/Users/hwanghyeonseong/Documents/GitHub/insect/project/data/nibr_section8_9.json'
MAIN_JSON = '/Users/hwanghyeonseong/Documents/GitHub/insect/project/data/nibr_insects.json'

PROMPT = """이 이미지는 한국 곤충 도감의 한 페이지입니다.
아래 JSON 형식으로 정보를 추출해 주세요. 이미지에 없는 항목은 빈 값으로 두세요.

{
  "habitat": "사는 곳 항목 텍스트 (없으면 null)",
  "morphology": ["형태적 특징 항목들을 배열로"],
  "ecology": ["생태 항목들을 배열로"],
  "other": ["기타 항목들을 배열로"]
}

규칙:
- habitat: '사는 곳' 줄의 값만 추출
- morphology: '형태적 특징' 섹션의 ▪ 항목들
- ecology: '생태' 섹션의 ▪ 항목들
- other: '기타' 섹션의 ▪ 항목들
- JSON만 출력하고 다른 텍스트는 쓰지 마세요
- 텍스트는 이미지에서 보이는 그대로 정확하게 옮겨 주세요"""


def encode_image(path):
    with open(path, 'rb') as f:
        return base64.standard_b64encode(f.read()).decode('utf-8')


def extract_from_image(client, image_path):
    b64 = encode_image(image_path)
    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=2048,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': 'image/jpeg',
                        'data': b64,
                    },
                },
                {'type': 'text', 'text': PROMPT}
            ],
        }]
    )
    text = message.content[0].text.strip()
    # JSON 블록만 추출
    if '```' in text:
        text = text.split('```')[1]
        if text.startswith('json'):
            text = text[4:]
    return json.loads(text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--api-key', default=os.environ.get('ANTHROPIC_API_KEY', ''))
    parser.add_argument('--resume', action='store_true', help='이미 채워진 항목은 건너뜀')
    args = parser.parse_args()

    if not args.api_key:
        print('오류: ANTHROPIC_API_KEY 환경변수 또는 --api-key 인자가 필요합니다.')
        sys.exit(1)

    client = anthropic.Anthropic(api_key=args.api_key)

    with open(SECTION_JSON, encoding='utf-8') as f:
        section_data = json.load(f)

    with open(MAIN_JSON, encoding='utf-8') as f:
        main_data = json.load(f)

    # main_data 인덱스: page -> index
    main_index = {entry['page']: i for i, entry in enumerate(main_data)}

    total = len(section_data)
    for idx, entry in enumerate(section_data):
        page = entry['page']
        name = entry['korean_name']

        if args.resume and (entry.get('habitat') or entry.get('morphology')):
            print(f'[{idx+1}/{total}] {name} (p.{page}) — 건너뜀 (이미 채워짐)')
            continue

        image_path = os.path.join(IMAGES_DIR, f'{page}.jpg')
        if not os.path.exists(image_path):
            print(f'[{idx+1}/{total}] {name} (p.{page}) — 이미지 없음, 건너뜀')
            continue

        print(f'[{idx+1}/{total}] {name} (p.{page}) 추출 중...', end=' ', flush=True)
        try:
            result = extract_from_image(client, image_path)

            entry['habitat'] = result.get('habitat')
            entry['morphology'] = result.get('morphology', [])
            entry['ecology'] = result.get('ecology', [])
            entry['other'] = result.get('other', [])

            # main_data에도 반영
            if page in main_index:
                mi = main_index[page]
                main_data[mi]['habitat'] = entry['habitat']
                main_data[mi]['morphology'] = entry['morphology']
                main_data[mi]['ecology'] = entry['ecology']
                main_data[mi]['other'] = entry['other']

            print('완료')

            # 매 5종마다 저장
            if (idx + 1) % 5 == 0:
                _save(section_data, main_data)
                print(f'  → 중간 저장 ({idx+1}/{total})')

            time.sleep(0.3)  # rate limit 방지

        except Exception as e:
            print(f'오류: {e}')
            _save(section_data, main_data)
            raise

    _save(section_data, main_data)
    filled = sum(1 for e in section_data if e.get('morphology'))
    print(f'\n완료: {filled}/{total}종 채움')
    print(f'저장: {SECTION_JSON}')
    print(f'저장: {MAIN_JSON}')


def _save(section_data, main_data):
    with open(SECTION_JSON, 'w', encoding='utf-8') as f:
        json.dump(section_data, f, ensure_ascii=False, indent=2)
    with open(MAIN_JSON, 'w', encoding='utf-8') as f:
        json.dump(main_data, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
