// src/components/Rating.js
import { StarIcon } from "lucide-react";
import React from "react";

const Rating = ({ value }: { value: number }) => {
  const filledStars = Math.floor(value);
  const isHalfStar = value % 1 !== 0;
  const totalStars = 5; // Total number of stars

  return (
    <div className="flex items-center">
      {[...Array(totalStars)].map((_, index) => {
        if (index < filledStars) {
          return <StarIcon key={index} className="text-yellow-500 w-6 h-6" />;
        } else if (index === filledStars && isHalfStar) {
          return <StarIcon key={index} className="text-yellow-500 w-6 h-6" strokeWidth="1" />;
        } else {
          return <StarIcon key={index} className="text-gray-300 w-6 h-6" strokeWidth="1" />;
        }
      })}
    </div>
  );
};

export default Rating;
