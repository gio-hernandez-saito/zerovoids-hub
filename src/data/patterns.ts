// 23개 GoF 디자인 패턴 메타데이터
// 각 패턴의 카테고리, 이름, 슬러그, 프레임워크 지원 여부를 정의한다.

export interface PatternMeta {
  name: string;
  slug: string;
  category: 'creational' | 'structural' | 'behavioral';
  categoryKo: string;
  description: string;
  frameworks: ('react' | 'vue' | 'svelte')[];
}

export const patterns: PatternMeta[] = [
  // ── Creational ──
  {
    name: 'Singleton',
    slug: 'singleton',
    category: 'creational',
    categoryKo: '생성',
    description: '클래스의 인스턴스를 하나만 보장하고 전역 접근점을 제공한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Factory Method',
    slug: 'factory-method',
    category: 'creational',
    categoryKo: '생성',
    description: '객체 생성을 서브클래스에 위임한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Abstract Factory',
    slug: 'abstract-factory',
    category: 'creational',
    categoryKo: '생성',
    description: '관련된 객체 군을 구체 클래스 지정 없이 생성한다.',
    frameworks: [],
  },
  {
    name: 'Builder',
    slug: 'builder',
    category: 'creational',
    categoryKo: '생성',
    description: '복잡한 객체의 생성 과정과 표현을 분리한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Prototype',
    slug: 'prototype',
    category: 'creational',
    categoryKo: '생성',
    description: '기존 객체를 복제하여 새 객체를 생성한다.',
    frameworks: [],
  },
  // ── Structural ──
  {
    name: 'Adapter',
    slug: 'adapter',
    category: 'structural',
    categoryKo: '구조',
    description: '호환되지 않는 인터페이스를 변환하여 함께 동작하게 한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Bridge',
    slug: 'bridge',
    category: 'structural',
    categoryKo: '구조',
    description: '추상화와 구현을 분리하여 독립적으로 변경 가능하게 한다.',
    frameworks: [],
  },
  {
    name: 'Composite',
    slug: 'composite',
    category: 'structural',
    categoryKo: '구조',
    description: '개별 객체와 복합 객체를 동일한 인터페이스로 다룬다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Decorator',
    slug: 'decorator',
    category: 'structural',
    categoryKo: '구조',
    description: '객체에 동적으로 새로운 기능을 추가한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Facade',
    slug: 'facade',
    category: 'structural',
    categoryKo: '구조',
    description: '복잡한 서브시스템에 단순한 인터페이스를 제공한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Flyweight',
    slug: 'flyweight',
    category: 'structural',
    categoryKo: '구조',
    description: '다수의 유사 객체가 데이터를 공유하여 메모리를 절약한다.',
    frameworks: [],
  },
  {
    name: 'Proxy',
    slug: 'proxy',
    category: 'structural',
    categoryKo: '구조',
    description: '다른 객체에 대한 대리자를 두어 접근을 제어한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  // ── Behavioral ──
  {
    name: 'Observer',
    slug: 'observer',
    category: 'behavioral',
    categoryKo: '행위',
    description: '상태 변화가 발생하면 의존 객체들에 자동으로 통지한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Strategy',
    slug: 'strategy',
    category: 'behavioral',
    categoryKo: '행위',
    description: '알고리즘을 캡슐화하여 런타임에 교체 가능하게 한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Command',
    slug: 'command',
    category: 'behavioral',
    categoryKo: '행위',
    description: '요청을 객체로 캡슐화하여 Undo/Redo를 가능하게 한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Chain of Responsibility',
    slug: 'chain-of-responsibility',
    category: 'behavioral',
    categoryKo: '행위',
    description: '요청을 처리할 수 있는 객체들의 체인을 따라 전달한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'State',
    slug: 'state',
    category: 'behavioral',
    categoryKo: '행위',
    description: '객체의 내부 상태에 따라 행위를 변경한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Template Method',
    slug: 'template-method',
    category: 'behavioral',
    categoryKo: '행위',
    description: '알고리즘의 골격을 정의하고 세부 단계를 서브클래스에 위임한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Mediator',
    slug: 'mediator',
    category: 'behavioral',
    categoryKo: '행위',
    description: '객체 간 직접 통신 대신 중재자를 통해 소통한다.',
    frameworks: ['react', 'vue', 'svelte'],
  },
  {
    name: 'Iterator',
    slug: 'iterator',
    category: 'behavioral',
    categoryKo: '행위',
    description: '컬렉션의 내부 구조를 노출하지 않고 요소를 순차 접근한다.',
    frameworks: [],
  },
  {
    name: 'Memento',
    slug: 'memento',
    category: 'behavioral',
    categoryKo: '행위',
    description: '객체의 상태를 저장하고 이전 상태로 복원한다.',
    frameworks: [],
  },
  {
    name: 'Visitor',
    slug: 'visitor',
    category: 'behavioral',
    categoryKo: '행위',
    description: '객체 구조를 변경하지 않고 새로운 연산을 추가한다.',
    frameworks: [],
  },
  {
    name: 'Interpreter',
    slug: 'interpreter',
    category: 'behavioral',
    categoryKo: '행위',
    description: '언어의 문법을 클래스로 표현하고 해석한다.',
    frameworks: [],
  },
];

export const categories = [
  { id: 'creational' as const, name: 'Creational', nameKo: '생성 패턴', color: '#10b981' },
  { id: 'structural' as const, name: 'Structural', nameKo: '구조 패턴', color: '#3b82f6' },
  { id: 'behavioral' as const, name: 'Behavioral', nameKo: '행위 패턴', color: '#8b5cf6' },
];

export function getPatternsByCategory(category: string) {
  return patterns.filter(p => p.category === category);
}

export function getPattern(category: string, slug: string) {
  return patterns.find(p => p.category === category && p.slug === slug);
}
