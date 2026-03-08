export interface FamousPerson {
  name: string;
  /** Hint shown after the timer drops below 50% */
  hint: string;
  imageUrl: string;
}

// All images are from Wikimedia Commons (public domain / freely licensed)
export const famousPersons: FamousPerson[] = [
  {
    name: "Albert Einstein",
    hint: "German-born physicist famous for the theory of relativity",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Albert_Einstein_Head.jpg/400px-Albert_Einstein_Head.jpg",
  },
  {
    name: "Marilyn Monroe",
    hint: "American actress and model, one of the most iconic sex symbols of the 1950s",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Marilyn_Monroe_in_1952.jpg/400px-Marilyn_Monroe_in_1952.jpg",
  },
  {
    name: "Charlie Chaplin",
    hint: "British comedian and filmmaker, famous for his Tramp character in silent films",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Charlie_Chaplin.jpg/400px-Charlie_Chaplin.jpg",
  },
  {
    name: "Audrey Hepburn",
    hint: "British actress and humanitarian, known for Breakfast at Tiffany's",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Audrey_Hepburn_1956.jpg/400px-Audrey_Hepburn_1956.jpg",
  },
  {
    name: "Elvis Presley",
    hint: "American singer known as the King of Rock and Roll",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Elvis_Presley_promoting_Jailhouse_Rock.jpg/400px-Elvis_Presley_promoting_Jailhouse_Rock.jpg",
  },
  {
    name: "Winston Churchill",
    hint: "British statesman who led the UK during World War II",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Sir_Winston_Churchill_-_19086236948.jpg/400px-Sir_Winston_Churchill_-_19086236948.jpg",
  },
  {
    name: "Muhammad Ali",
    hint: "American boxer widely regarded as one of the greatest heavyweights of all time",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Muhammad_Ali_NYWTS.jpg/400px-Muhammad_Ali_NYWTS.jpg",
  },
  {
    name: "Nelson Mandela",
    hint: "South African anti-apartheid leader and the country's first Black president",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Nelson_Mandela_-_2008_%28edit%29.jpg/400px-Nelson_Mandela_-_2008_%28edit%29.jpg",
  },
  {
    name: "Marie Curie",
    hint: "Polish-French physicist and chemist, first woman to win a Nobel Prize",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Marie_Curie_c1920.jpg/400px-Marie_Curie_c1920.jpg",
  },
  {
    name: "Abraham Lincoln",
    hint: "16th President of the United States who abolished slavery",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Abraham_Lincoln_O-77_matte_collodion_print.jpg/400px-Abraham_Lincoln_O-77_matte_collodion_print.jpg",
  },
];
