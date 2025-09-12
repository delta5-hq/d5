import {createChildren, createItem, createTree, findNode, getByIndexSafe, serializeNode} from './createTree'

describe('createTree', () => {
  it('should return correct tree №1', () => {
    const arr = [['Economic Security', 'Financial Stability']]
    const result = createTree(arr)
    expect(result).toBe('Economic Security\n  Financial Stability\n')
  })

  it('should return correct tree №2', () => {
    const arr = [['Economic Security', ['Financial Stability', 'Economic Risks'], 'some weird text']]
    const result = createTree(arr)
    expect(result).toBe('Economic Security\n  Financial Stability\n  Economic Risks\n')
  })

  it('should return correct tree №3', () => {
    const arr = [['Economic Security', ['Financial Stability', 'Economic Risks'], ['some weird array', 'arr2']]]

    const result = createTree(arr)
    expect(result).toBe('Economic Security\n  Financial Stability\n  Economic Risks\n')
  })

  it('should return correct tree №4', () => {
    const arr = [
      ['Economic Security', ['Financial Stability', 'Economic Risks']],
      ['Cash Flow', []],
      ['Financial Stability', 'Cash Flow'],
    ]

    const result = createTree(arr)
    expect(result).toBe(`Economic Security
  Financial Stability
    Cash Flow
  Economic Risks
`)
  })

  it('should return correct tree №5', () => {
    const arr = [
      [
        'Computer',
        [
          'Central Processing Unit (CPU)',
          'Motherboard',
          'Memory (RAM)',
          'Storage Devices',
          'Graphics Card',
          'Power Supply Unit (PSU)',
          'Input/Output Devices',
        ],
      ],
      ['Storage Devices', ['Hard Drives', 'Solid-State Drives']],
      ['Input/Output Devices', ['Keyboards', 'Mice', 'Monitors']],
      [
        'Digital Electronics Components',
        ['Transistors', 'Resistors', 'Inductors', 'Capacitors', 'Printed Circuit Boards'],
      ],
      [
        'Integrated Circuits',
        [
          'Hybrid Integrated Circuits (HICs)',
          'Three-Dimensional Integrated Circuits (3D ICs)',
          'Application-Specific Integrated Circuits (ASICs)',
        ],
      ],
      ['Digital Circuit Design', ['Digital Signal Processing', 'Logic Synthesis', 'Computer Architecture']],
      [
        'Design Verification',
        ['Hardware Description Languages', 'High-Level Synthesis', 'Formal Equivalence Checking'],
      ],
      [
        'External Devices',
        [
          'CD/DVD Drives',
          'All-in-One Readers',
          'Power Cords',
          'Printers',
          'Scanners',
          'UPS (Uninterruptible Power Supply)',
        ],
      ],
    ]

    const result = createTree(arr)
    expect(result).toBe(`Computer
  Central Processing Unit (CPU)
  Motherboard
  Memory (RAM)
  Storage Devices
    Hard Drives
    Solid-State Drives
  Graphics Card
  Power Supply Unit (PSU)
  Input/Output Devices
    Keyboards
    Mice
    Monitors
Digital Electronics Components
  Transistors
  Resistors
  Inductors
  Capacitors
  Printed Circuit Boards
Integrated Circuits
  Hybrid Integrated Circuits (HICs)
  Three-Dimensional Integrated Circuits (3D ICs)
  Application-Specific Integrated Circuits (ASICs)
Digital Circuit Design
  Digital Signal Processing
  Logic Synthesis
  Computer Architecture
Design Verification
  Hardware Description Languages
  High-Level Synthesis
  Formal Equivalence Checking
External Devices
  CD/DVD Drives
  All-in-One Readers
  Power Cords
  Printers
  Scanners
  UPS (Uninterruptible Power Supply)
`)
  })

  it('should return correct tree №6', () => {
    const arr = [
      [
        'CPU',
        [
          'Arithmetic and Logical Unit (ALU)',
          'Control Unit (CU)',
          'Memory Unit',
          'Cache Memory',
          'Buses',
          'Clocks',
          'Multiple Cores',
          'Memory Management Unit (MMU)',
          'Cache Memory',
        ],
      ],
      ['Arithmetic and Logical Unit (ALU)', []],
      ['Control Unit (CU)', []],
      ['Memory Unit', []],
      ['Cache Memory', []],
      ['Buses', []],
      ['Clocks', []],
      ['Multiple Cores', []],
      ['Memory Management Unit (MMU)', []],
      ['Cache Memory', []],
    ]

    const result = createTree(arr)
    expect(result).toBe(`CPU
  Arithmetic and Logical Unit (ALU)
  Control Unit (CU)
  Memory Unit
  Cache Memory
  Buses
  Clocks
  Multiple Cores
  Memory Management Unit (MMU)
  Cache Memory
`)
  })

  it('should return correct tree №7', () => {
    const arr = [
      ['CPU', ['Control Unit', 'Arithmetic Logic Unit', 'Registers', 'Cache', 'Buses', 'Clock']],
      ['Control Unit', ['Main Memory', 'Input/Output Devices']],
      ['Arithmetic Logic Unit', ['Registers', 'Primary Memory', 'Secondary Memory']],
      ['Registers', []],
      ['Cache', ['L1 Cache', 'L2 Cache', 'L3 Cache']],
      ['Buses', ['Address Bus', 'Data Bus', 'Control Bus']],
      ['Clock', []],
      ['Main Memory', []],
      ['Input/Output Devices', []],
      ['Primary Memory', []],
      ['Secondary Memory', []],
      ['L1 Cache', []],
      ['L2 Cache', []],
      ['L3 Cache', []],
      ['Address Bus', []],
      ['Data Bus', []],
      ['Control Bus', []],
    ]

    const result = createTree(arr)
    expect(result).toBe(`CPU
  Control Unit
    Main Memory
    Input/Output Devices
  Arithmetic Logic Unit
    Registers
    Primary Memory
    Secondary Memory
  Cache
    L1 Cache
    L2 Cache
    L3 Cache
  Buses
    Address Bus
    Data Bus
    Control Bus
  Clock
`)
  })

  it('should return correct tree №8', () => {
    const arr = [
      [
        'Saint Petersburg',
        [
          'Founder',
          'Tsar Peter the Great',
          'Name',
          'City',
          'Saint Peter',
          'Apostle',
          'Jesus Christ',
          'Patron Saint',
          'Fishermen',
          'Amsterdam',
          'Geographic Layout',
          'Canals',
          'Rivers',
          'Vision',
          'Transforming Russia',
          'Modern European Power',
          'New Capital City',
          'Great Cities',
          'Western Europe',
        ],
      ],
      ['Founder', ['Tsar Peter the Great']],
      ['Tsar Peter the Great', []],
      ['Name', ['City']],
      ['City', []],
      ['Saint Peter', ['Apostle', 'Jesus Christ']],
      ['Apostle', ['Jesus Christ']],
      ['Jesus Christ', ['Patron Saint']],
      ['Patron Saint', ['Fishermen']],
      ['Fishermen', []],
      ['Amsterdam', ['Geographic Layout', 'Canals', 'Rivers']],
      ['Geographic Layout', []],
      ['Canals', []],
      ['Rivers', []],
      [
        'Vision',
        ['Transforming Russia', 'Modern European Power', 'New Capital City', 'Great Cities', 'Western Europe'],
      ],
      ['Transforming Russia', []],
      ['Modern European Power', []],
      ['New Capital City', []],
      ['Great Cities', []],
      ['Western Europe', []],
    ]

    const result = createTree(arr)
    expect(result).toBe(`Saint Petersburg
  Founder
    Tsar Peter the Great
  Name
    City
  Saint Peter
    Apostle
      Jesus Christ
        Patron Saint
          Fishermen
  Amsterdam
    Geographic Layout
    Canals
    Rivers
  Vision
    Transforming Russia
    Modern European Power
    New Capital City
    Great Cities
    Western Europe
`)
  })
})

describe('getByIndexSafe', () => {
  it('should return the correct value for string arrays', () => {
    expect(getByIndexSafe(['one', 'two', 'three'], 1)).toBe('two')
  })

  it('should return the value itself for a single string', () => {
    expect(getByIndexSafe('hello', 0)).toBe('hello')
  })

  it('should return undefined', () => {
    expect(getByIndexSafe(['hello'], 1)).toBe(undefined)
  })
})

describe('createChildren', () => {
  it('should return empty array', () => {
    expect(createChildren([])).toEqual([])
  })

  it('should return empty array', () => {
    expect(createChildren('')).toEqual([])
  })

  it('should return array with one item without children', () => {
    expect(createChildren('name')).toEqual([
      {
        name: 'name',
        children: [],
      },
    ])
  })

  it('should return array', () => {
    expect(createChildren(['name1', 'name2'])).toEqual([
      {name: 'name1', children: []},
      {name: 'name2', children: []},
    ])
  })
})

describe('createItem', () => {
  it('should return new item without children', () => {
    expect(createItem('name')).toEqual({
      name: 'name',
      children: [],
    })
  })

  it('should return new item with children', () => {
    expect(createItem('name', ['child1', 'child2'])).toEqual({
      name: 'name',
      children: [
        {
          name: 'child1',
          children: [],
        },
        {
          name: 'child2',
          children: [],
        },
      ],
    })
  })
})

describe('findNode', () => {
  it('should return item', () => {
    expect(
      findNode(
        [
          {
            name: 'name1',
            children: [],
          },
          {
            name: 'name2',
            children: [],
          },
        ],
        'name1',
      ),
    ).toEqual({
      name: 'name1',
      children: [],
    })
  })

  it('should return item', () => {
    expect(
      findNode(
        [
          {
            name: 'name1',
            children: [
              {
                name: 'name3',
                children: [],
              },
            ],
          },
          {
            name: 'name2',
            children: [],
          },
        ],
        'name1',
      ),
    ).toEqual({
      name: 'name1',
      children: [
        {
          name: 'name3',
          children: [],
        },
      ],
    })
  })

  it('should return undefined', () => {
    expect(
      findNode(
        [
          {
            name: 'name1',
            children: [
              {
                name: 'name3',
                children: [],
              },
            ],
          },
          {
            name: 'name2',
            children: [],
          },
        ],
        'name4',
      ),
    ).toEqual(undefined)
  })
})

describe('serializeNode', () => {
  it('should return string', () => {
    expect(serializeNode({name: 'name1', children: [{name: 'child1'}]})).toBe('name1\n  child1')
  })
})
