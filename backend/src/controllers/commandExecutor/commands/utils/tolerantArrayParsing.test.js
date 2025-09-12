import {tolerantArrayParsing} from './tolerantArrayParsing'

describe('tolerantArrayParsing', () => {
  it('should return empty array with empty string', () => {
    const INPUT_STRING = "['', []]"
    const result = tolerantArrayParsing(INPUT_STRING)

    expect(result).toEqual(['', []])
  })

  it('should return empty array', () => {
    const INPUT_STRING = '[]'
    const result = tolerantArrayParsing(INPUT_STRING)

    expect(result).toEqual([])
  })

  it('should return valid array #1', () => {
    const INPUT_STRING = `[
        ["United States", ["New York", "California", "Texas"]],
        ["New York", ["New York City", "Buffalo", "Albany"]],
        ["California", ["Los Angeles", "San Francisco", "San Diego"]],
        ["Texas", ["Houston", "Austin", "Dallas", "San Antonio"]],
        ["Florida", ["Miami", "Orlando", "Tampa"]],
        ["Illinois", ["Chicago", "Springfield", "Peoria"]],
        ["Ohio", ["Columbus", "Cleveland", "Cincinnati"]],
        ["Georgia", ["Atlanta", "Savannah", "Augusta"]],
        ["Colorado", ["Denver", "Boulder", "Colorado Springs"]],
        ["Washington", ["Seattle", "Tacoma", "Spokane"]]
      ]`

    const result = tolerantArrayParsing(INPUT_STRING)

    expect(result).toEqual([
      ['United States', ['New York', 'California', 'Texas']],
      ['New York', ['New York City', 'Buffalo', 'Albany']],
      ['California', ['Los Angeles', 'San Francisco', 'San Diego']],
      ['Texas', ['Houston', 'Austin', 'Dallas', 'San Antonio']],
      ['Florida', ['Miami', 'Orlando', 'Tampa']],
      ['Illinois', ['Chicago', 'Springfield', 'Peoria']],
      ['Ohio', ['Columbus', 'Cleveland', 'Cincinnati']],
      ['Georgia', ['Atlanta', 'Savannah', 'Augusta']],
      ['Colorado', ['Denver', 'Boulder', 'Colorado Springs']],
      ['Washington', ['Seattle', 'Tacoma', 'Spokane']],
    ])
  })

  it('should return valid array #2', () => {
    const INPUT_STRING = `[["Fruits", ["Citrus", "Berries", "Tropical"]],
    ["Citrus", ["Oranges", "Lemons", "Grapefruits"]],
    ["Berries", ["Strawberries", "Blueberries", "Raspberries", "Blackberries"]],
    ["Tropical", ["Pineapple", "Mango", "Papaya", "Coconut"]],
    ["Stone Fruits", ["Peaches", "Plums", "Cherries"]],
    ["Melons", ["Watermelon", "Cantaloupe", "Honeydew"]],
    ["Apples", ["Granny Smith", "Red Delicious", "Fuji"]],
    ["Grapes", ["Red Grapes", "Green Grapes", "Black Grapes"]],
    ["Bananas", []],
    ["Pears", []]]`
    const result = tolerantArrayParsing(INPUT_STRING)

    expect(result).toEqual([
      ['Fruits', ['Citrus', 'Berries', 'Tropical']],
      ['Citrus', ['Oranges', 'Lemons', 'Grapefruits']],
      ['Berries', ['Strawberries', 'Blueberries', 'Raspberries', 'Blackberries']],
      ['Tropical', ['Pineapple', 'Mango', 'Papaya', 'Coconut']],
      ['Stone Fruits', ['Peaches', 'Plums', 'Cherries']],
      ['Melons', ['Watermelon', 'Cantaloupe', 'Honeydew']],
      ['Apples', ['Granny Smith', 'Red Delicious', 'Fuji']],
      ['Grapes', ['Red Grapes', 'Green Grapes', 'Black Grapes']],
      ['Bananas', []],
      ['Pears', []],
    ])
  })

  it('should return valid array #3', () => {
    const INPUT_STRING = `[
        ["Animal Kingdom", ["Mammals", "Birds", "Reptiles", "Amphibians", "Fish"]],
        ["Mammals", ["Elephant", "Lion", "Dolphin", "Kangaroo"]],
        ["Birds", ["Eagle", "Ostrich", "Parrot", "Penguin"]],
        ["Reptiles", ["Snake", "Lizard", "Turtle", "Crocodile"]],
        ["Amphibians", ["Frog", "Salamander", "Newt"]],
        ["Fish", ["Salmon", "Tuna", "Clownfish", "Shark"]],
        ["Insects", ["Ant", "Butterfly", "Bee", "Spider"]],
        ["Marine Mammals", ["Dolphin", "Whale", "Seal"]],
        ["Rodents", ["Mouse", "Rat", "Squirrel"]],
        ["Big Cats", ["Lion", "Tiger", "Leopard"]],
      ]`
    const result = tolerantArrayParsing(INPUT_STRING)

    expect(result).toEqual([
      ['Animal Kingdom', ['Mammals', 'Birds', 'Reptiles', 'Amphibians', 'Fish']],
      ['Mammals', ['Elephant', 'Lion', 'Dolphin', 'Kangaroo']],
      ['Birds', ['Eagle', 'Ostrich', 'Parrot', 'Penguin']],
      ['Reptiles', ['Snake', 'Lizard', 'Turtle', 'Crocodile']],
      ['Amphibians', ['Frog', 'Salamander', 'Newt']],
      ['Fish', ['Salmon', 'Tuna', 'Clownfish', 'Shark']],
      ['Insects', ['Ant', 'Butterfly', 'Bee', 'Spider']],
      ['Marine Mammals', ['Dolphin', 'Whale', 'Seal']],
      ['Rodents', ['Mouse', 'Rat', 'Squirrel']],
      ['Big Cats', ['Lion', 'Tiger', 'Leopard']],
    ])
  })

  it('should return valid array #4', () => {
    const INPUT_STRING = `
    [
        ["Programming Languages", ["High-level", "Low-level", "Scripting"]],
        ["High-level", ["JavaScript", "Python", "Java", "Ruby"]],
        ["Low-level", ["C", "C++", "Assembly"]],
        ["Scripting", ["Python", "Ruby", "Perl", "Bash"]],
        ["Functional", ["Haskell", "Erlang", "Scala"]],
        ["Object-oriented", ["Java", "Python", "C++", "C#"]],
        ["Web Development", ["HTML", "CSS", "JavaScript", "PHP"]],
        ["Data Science", ["Python", "R", "Julia"]],
        ["Mobile App Development", ["Swift", "Kotlin", "Flutter"]],
        ["Game Development", ["Unity", "Unreal Engine", "Godot"]],
      ]`
    const result = tolerantArrayParsing(INPUT_STRING)

    expect(result).toEqual([
      ['Programming Languages', ['High-level', 'Low-level', 'Scripting']],
      ['High-level', ['JavaScript', 'Python', 'Java', 'Ruby']],
      ['Low-level', ['C', 'C++', 'Assembly']],
      ['Scripting', ['Python', 'Ruby', 'Perl', 'Bash']],
      ['Functional', ['Haskell', 'Erlang', 'Scala']],
      ['Object-oriented', ['Java', 'Python', 'C++', 'C#']],
      ['Web Development', ['HTML', 'CSS', 'JavaScript', 'PHP']],
      ['Data Science', ['Python', 'R', 'Julia']],
      ['Mobile App Development', ['Swift', 'Kotlin', 'Flutter']],
      ['Game Development', ['Unity', 'Unreal Engine', 'Godot']],
    ])
  })

  it('should return valid array #5', () => {
    const INPUT_STRING = `
    [
        ["Book Genres", ["Fiction", "Non-fiction", "Mystery", "Fantasy", "Science Fiction"]],
        ["Fiction", ["Literary Fiction", "Historical Fiction", "Romance", "Thriller"]],
        ["Non-fiction", ["Biography", "Self-help", "Cooking", "History"]],
        ["Mystery", ["Detective", "Cozy Mystery", "Noir"]],
        ["Fantasy", ["Epic Fantasy", "Urban Fantasy", "High Fantasy"]],
        ["Science Fiction", ["Space Opera", "Cyberpunk", "Dystopian"]],
        ["Horror", ["Supernatural", "Psychological", "Survival"]],
        ["Young Adult", ["Contemporary", "Dystopian", "Fantasy"]],
        ["Classics", ["Pride and Prejudice", "Moby-Dick", "1984"]],
        ["Memoir", []],
      ]`
    const result = tolerantArrayParsing(INPUT_STRING)

    expect(result).toEqual([
      ['Book Genres', ['Fiction', 'Non-fiction', 'Mystery', 'Fantasy', 'Science Fiction']],
      ['Fiction', ['Literary Fiction', 'Historical Fiction', 'Romance', 'Thriller']],
      ['Non-fiction', ['Biography', 'Self-help', 'Cooking', 'History']],
      ['Mystery', ['Detective', 'Cozy Mystery', 'Noir']],
      ['Fantasy', ['Epic Fantasy', 'Urban Fantasy', 'High Fantasy']],
      ['Science Fiction', ['Space Opera', 'Cyberpunk', 'Dystopian']],
      ['Horror', ['Supernatural', 'Psychological', 'Survival']],
      ['Young Adult', ['Contemporary', 'Dystopian', 'Fantasy']],
      ['Classics', ['Pride and Prejudice', 'Moby-Dick', '1984']],
      ['Memoir', []],
    ])
  })

  it('should return valid array without incorrect values', () => {
    const INPUT_STRING = `[
      ["US Government", ["Executive Branch", "Legislative Branch", "Judicial Branch"]],
      ["Executive Branch", ["Vice President", "Cabinet", "Executive Office of the President", "Executive Agencies", "Regulatory Commissions"]],
      ["Cabinet", ["President's Chief of Staff", "Administrator of the Environmental Protection Agency", "Director of the Office of Management and Budget", "U.S. Trade Representative", "Director of the Office of National Drug Control Policy"]],
      ["Executive Office of the President", ["Chief of Staff", "Director of the Office of Management and Budget", "Director of the National Economic Council", "National Security Advisor"]],
      ["Executive Agencies", ["Defense Department", "State Department", "Treasury Department"]],
      ["Regulatory Commissions", []],
      ["Legislative Branch", []],
      ["Judicial Branch", []],
      ["Department of Education", [], ],
      ["Department of Energy", []],
      ["Department of Health and Human Services", []],
      ["Department of Homeland Security", []],
      ["Department of Housing and Urban Development", []],
      ["Department of the Interior", []],
      ["Department of Justice", []]
      ["Department of Labor", []],
      ["Department of State", []]
      ["Department of Transportation", []]
      ["Department of the Treasury", []],
      ["Department of Veterans Affairs", "`

    const result = tolerantArrayParsing(INPUT_STRING)

    expect(result).toEqual([
      ['US Government', ['Executive Branch', 'Legislative Branch', 'Judicial Branch']],
      [
        'Executive Branch',
        [
          'Vice President',
          'Cabinet',
          'Executive Office of the President',
          'Executive Agencies',
          'Regulatory Commissions',
        ],
      ],
      [
        'Cabinet',
        [
          "President's Chief of Staff",
          'Administrator of the Environmental Protection Agency',
          'Director of the Office of Management and Budget',
          'U.S. Trade Representative',
          'Director of the Office of National Drug Control Policy',
        ],
      ],
      [
        'Executive Office of the President',
        [
          'Chief of Staff',
          'Director of the Office of Management and Budget',
          'Director of the National Economic Council',
          'National Security Advisor',
        ],
      ],
      ['Executive Agencies', ['Defense Department', 'State Department', 'Treasury Department']],
      ['Regulatory Commissions', []],
      ['Legislative Branch', []],
      ['Judicial Branch', []],
      ['Department of Education', []],
      ['Department of Energy', []],
      ['Department of Health and Human Services', []],
      ['Department of Homeland Security', []],
      ['Department of Housing and Urban Development', []],
      ['Department of the Interior', []],
      ['Department of Justice', []],
      ['Department of State', []],
    ])
  })

  it('should return valid array; after horror absent bracket', () => {
    const INPUT_STRING = `
    [
        ["Book Genres", ["Fiction", "Non-fiction", "Mystery", "Fantasy", "Science Fiction"]],
        ["Fiction", ["Literary Fiction", "Historical Fiction", "Romance", "Thriller"]],
        ["Non-fiction", ["Biography", "Self-help", "Cooking", "History"]],
        ["Mystery", ["Detective", "Cozy Mystery", "Noir"]],
        ["Fantasy", ["Epic Fantasy", "Urban Fantasy", "High Fantasy"]],
        ["Science Fiction", ["Space Opera", "Cyberpunk", "Dystopian"]],
        ["Horror", ["Supernatural", "Psychological", "Survival"],
        ["Young Adult", ["Contemporary", "Dystopian", "Fantasy"]],
        ["Classics", ["Pride and Prejudice", "Moby-Dick", "1984"]]
        ["Memoir", []],
      `
    const result = tolerantArrayParsing(INPUT_STRING)

    expect(result).toEqual([
      ['Book Genres', ['Fiction', 'Non-fiction', 'Mystery', 'Fantasy', 'Science Fiction']],
      ['Fiction', ['Literary Fiction', 'Historical Fiction', 'Romance', 'Thriller']],
      ['Non-fiction', ['Biography', 'Self-help', 'Cooking', 'History']],
      ['Mystery', ['Detective', 'Cozy Mystery', 'Noir']],
      ['Fantasy', ['Epic Fantasy', 'Urban Fantasy', 'High Fantasy']],
      ['Science Fiction', ['Space Opera', 'Cyberpunk', 'Dystopian']],
      [
        'Horror',
        ['Supernatural', 'Psychological', 'Survival'],
        ['Young Adult', ['Contemporary', 'Dystopian', 'Fantasy']],
        ['Classics', ['Pride and Prejudice', 'Moby-Dick', '1984']],
      ],
    ])
  })
})
