/** Learning paths, shared by the Learn page, the homepage and search. */
export const LEARN_PATHS = [
  {
    id: 'basics',
    title: 'Coffee basics',
    short: 'Start here. Essential knowledge and simple recipes.',
    description:
      'Essential knowledge and simple recipes: what gear you actually need, how grind size works, and your first great cups.',
    image: '/images/learn-basics.jpg',
  },
  {
    id: 'espresso',
    title: 'Dial in espresso',
    short: 'Dial in with confidence and consistency.',
    description:
      'From your first shot to consistent, repeatable espresso: dose, yield, time, and how to taste the difference.',
    image: '/images/learn-espresso.jpg',
  },
  {
    id: 'beans',
    title: 'Understand your beans',
    short: 'Origin, processing, roast, and flavor.',
    description:
      'Origin, processing, roast level, and flavor — how to read a bag of coffee and pick beans you will love.',
    image: '/images/learn-beans.jpg',
  },
] as const;
